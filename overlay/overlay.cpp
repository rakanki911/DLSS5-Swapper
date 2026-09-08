// Which %APPDATA% folder holds the bridge endpoint, the hotkey preferences
// and the pipe name. scripts/build-overlay.ps1 passes it as a bare token
// (-DLAB_OVERLAY_PROFILE=dlss5-swapper) because quotes in a -D flag do not
// survive the shell; the widening happens here instead.
#ifndef LAB_OVERLAY_PROFILE
#define LAB_OVERLAY_PROFILE dlss5-lab
#endif
#define LAB_PROFILE_STR2(x) #x
#define LAB_PROFILE_STR(x) LAB_PROFILE_STR2(x)
#define LAB_PROFILE_WIDE2(x) L##x
#define LAB_PROFILE_WIDE(x) LAB_PROFILE_WIDE2(x)
#define LAB_PROFILE_W LAB_PROFILE_WIDE(LAB_PROFILE_STR(LAB_OVERLAY_PROFILE))

// SPDX-License-Identifier: MIT
// Exact Chromium UI from the app, transported as interactive pixels. This add-on
// does NOT implement NVIDIA DLSS. The automatic v4.7 adapter delegates real
// settings to RenoDX's original UI callback; unsupported masks/models stay off.

#include <imgui.h>
#include <reshade.hpp>
#include <array>
#include <vector>
#include <deque>
#include <string>
#include <unordered_map>
#include <memory>
#include <algorithm>
#include <cstring>
#include "live-controls.hpp"
#include "renodx-ui-bridge.hpp"
#include "feeder-controls.hpp"
#include "overlay-hotkey.hpp"
#ifdef LAB_RENODX_PROBE
#include "renodx-ui-probe.hpp"
#endif

extern "C" __declspec(dllexport) const char *NAME = "DLSS 5 Swapper Overlay";
extern "C" __declspec(dllexport) const char *DESCRIPTION = "F8: compact panel. Keep DLSS 5 Swapper open. The game's input is held while the panel is open. Automatic experimental RenoDX v4.7 bridge controls original NR settings; exact binary required. Original ReShade/RenoDX windows remain available.";
extern "C" __declspec(dllexport) const char *AUTHOR = "DLSS 5 Swapper";
extern "C" void lab_imgui_vec2(void *, float *, float *);
static_assert(IMGUI_VERSION_NUM == 19250, "Revalidate the ReShade/ImGui ABI before changing SDKs");

namespace {
constexpr uint32_t frame_magic = 0x31464c44, input_magic = 0x31494c44;
constexpr uint32_t panel_width = 534, max_height = 1600, max_frame = panel_width * max_height * 4 + 24;
struct input_packet { uint32_t magic = input_magic, action; int32_t x, y, value; };
static_assert(sizeof(input_packet) == 20);

class connection {
    HANDLE pipe = INVALID_HANDLE_VALUE;
    OVERLAPPED read_op = {}, write_op = {};
    bool reading = false, writing = false;
    std::array<unsigned char, 524288> read_buffer;
    std::vector<unsigned char> incoming;
    std::deque<std::vector<unsigned char>> outgoing;
    std::vector<unsigned char> write_buffer;
    ULONGLONG retry_at = 0;
    bool connect() {
        if (GetTickCount64() < retry_at) return false;
        retry_at = GetTickCount64() + 1000;
        wchar_t directory[32768] = {};
#ifdef LAB_OVERLAY_SMOKE
        DWORD n = GetEnvironmentVariableW(L"DLSS_LAB_SMOKE_PROFILE", directory, 32768);
#else
        DWORD n = GetEnvironmentVariableW(L"APPDATA", directory, 32768);
#endif
        if (!n || n >= 32768) return false;
        std::wstring filename(directory);
#ifndef LAB_OVERLAY_SMOKE
        filename += L"\\" LAB_PROFILE_W;
#endif
        filename += L"\\overlay-bridge.endpoint";
        HANDLE file = CreateFileW(filename.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (file == INVALID_HANDLE_VALUE) return false;
        char token[33] = {}; DWORD count = 0;
        bool valid = ReadFile(file, token, 33, &count, nullptr) && count == 32; CloseHandle(file);
        if (!valid) return false;
        std::wstring name = L"\\\\.\\pipe\\" LAB_PROFILE_W L"-overlay-";
        for (unsigned i = 0; i < 32; ++i) {
            if (!((token[i] >= '0' && token[i] <= '9') || (token[i] >= 'a' && token[i] <= 'f'))) return false;
            name += wchar_t(token[i]);
        }
        pipe = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, FILE_FLAG_OVERLAPPED | SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION, nullptr);
        if (pipe == INVALID_HANDLE_VALUE) return false;
        // A legacy Lab understands this as an unrelated frame ACK and ignores
        // it. Never send new status packets before the peer opts into them.
        send(0, 0, 0, 0x4c414234);
        return true;
    }
    bool consume(DWORD count) {
        if (incoming.size() + count > max_frame + 65536) { disconnect(); return false; }
        incoming.insert(incoming.end(), read_buffer.begin(), read_buffer.begin() + count);
        while (incoming.size() >= 24) {
            uint32_t h[6]; memcpy(h, incoming.data(), 24);
            if (h[0] == 0x31484c44 && h[1] == 1 && (h[2] == 1 || h[2] == 3 || h[2] == 7 || h[2] == 15) && !h[3] && !h[4] && !h[5]) {
                live_peer = true; nr_peer = h[2] >= 7; feed_peer = h[2] == 15;
                incoming.erase(incoming.begin(), incoming.begin() + 24); continue;
            }
            if (h[0] == 0x31434c44 && h[1] == 1) {
                if (!live_peer) { disconnect(); return false; }
                float value; memcpy(&value, &h[5], 4);
                if (commands.size() >= 128) { disconnect(); return false; }
                commands.push_back({h[2], h[3], h[4], value});
                incoming.erase(incoming.begin(), incoming.begin() + 24); continue;
            }
            if (h[0] != frame_magic || h[1] != 1 || h[3] != panel_width || !h[4] || h[4] > max_height || h[5] != h[3] * h[4] * 4) { disconnect(); return false; }
            if (incoming.size() < h[5] + 24) break;
            pixels.assign(incoming.begin() + 24, incoming.begin() + h[5] + 24); height = h[4]; sequence = h[2];
            incoming.erase(incoming.begin(), incoming.begin() + h[5] + 24);
            send(0, 0, 0, static_cast<int32_t>(sequence));
        }
        return true;
    }
public:
    std::vector<unsigned char> pixels;
    std::vector<lab_live::command> commands;
    uint32_t height = 0, sequence = 0;
    bool live_peer = false, nr_peer = false, feed_peer = false;
    connection() { read_op.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr); write_op.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr); }
    ~connection() { disconnect(); CloseHandle(read_op.hEvent); CloseHandle(write_op.hEvent); }
    bool connected() const { return pipe != INVALID_HANDLE_VALUE; }
    void disconnect() {
        if (connected()) {
            CancelIoEx(pipe, nullptr);
            DWORD ignored;
            if (reading) GetOverlappedResult(pipe, &read_op, &ignored, TRUE);
            if (writing) GetOverlappedResult(pipe, &write_op, &ignored, TRUE);
            CloseHandle(pipe); pipe = INVALID_HANDLE_VALUE;
        }
        reading = writing = live_peer = nr_peer = feed_peer = false; incoming.clear(); outgoing.clear(); commands.clear(); pixels.clear(); sequence = height = 0;
    }
    void send(uint32_t action, int32_t x, int32_t y, int32_t value = 0) {
        if (!connected()) return;
        if (action == 6 && !live_peer) { action = 3; x = y = -1; }
        if (action == 1 && !outgoing.empty() && outgoing.back().size() == 20 && outgoing.back()[4] == 1) outgoing.pop_back();
        if (outgoing.size() >= 64) { disconnect(); return; }
        input_packet packet = {input_magic, action, x, y, value};
        const auto bytes = reinterpret_cast<const unsigned char *>(&packet);
        outgoing.emplace_back(bytes, bytes + sizeof(packet));
    }
    void status(const std::string &json) {
#ifdef LAB_OVERLAY_SMOKE
        char live[2]; if (!GetEnvironmentVariableA("DLSS_LAB_SMOKE_LIVE", live, 2)) return;
#endif
        if (!connected() || !live_peer || json.size() > 60000 || outgoing.size() > 32) return;
        uint32_t h[2] = {0x31534c44, static_cast<uint32_t>(json.size())};
        std::vector<unsigned char> packet(8 + json.size());
        memcpy(packet.data(), h, 8); memcpy(packet.data() + 8, json.data(), json.size());
        outgoing.push_back(std::move(packet));
    }
    void poll() {
        if (!connected() && !connect()) return;
        DWORD count;
        if (writing) {
            if (!GetOverlappedResult(pipe, &write_op, &count, FALSE)) { if (GetLastError() != ERROR_IO_INCOMPLETE) disconnect(); }
            else { writing = false; if (count != write_buffer.size()) disconnect(); }
        }
        if (!connected()) return;
        for (unsigned sent = 0; sent < 8 && !writing && !outgoing.empty(); ++sent) {
            write_buffer = outgoing.front(); outgoing.pop_front(); ResetEvent(write_op.hEvent);
            if (!WriteFile(pipe, write_buffer.data(), static_cast<DWORD>(write_buffer.size()), &count, &write_op)) {
                if (GetLastError() == ERROR_IO_PENDING) writing = true; else { disconnect(); return; }
            } else if (count != write_buffer.size()) { disconnect(); return; }
        }
        // Never wait for Lab on the render thread. Each call has bounded work.
        for (unsigned i = 0; i < 64; ++i) {
            if (reading) {
                if (!GetOverlappedResult(pipe, &read_op, &count, FALSE)) { if (GetLastError() != ERROR_IO_INCOMPLETE) disconnect(); return; }
                reading = false;
                if (!count || !consume(count)) return;
            }
            DWORD available = 0;
            if (!PeekNamedPipe(pipe, nullptr, 0, nullptr, &available, nullptr)) { disconnect(); return; }
            if (!available) return;
            ResetEvent(read_op.hEvent);
            if (!ReadFile(pipe, read_buffer.data(), std::min<DWORD>(available, read_buffer.size()), &count, &read_op)) {
                if (GetLastError() == ERROR_IO_PENDING) reading = true; else disconnect();
                return;
            }
            if (!count || !consume(count)) return;
        }
    }
};

struct surface {
    lab_hotkey::binding hotkey;
    feed_live::controls feed;
    connection bridge;
    reshade::api::resource texture = {};
    reshade::api::resource_view view = {};
    uint32_t uploaded = 0, texture_height = 0;
    bool dragging = false, focused = false, hovered = false;
    int last_x = -9999, last_y = -9999;
    bool open = false, was_open = false, moving = false;
    lab_live::controls live;
    nr_live::controls nr;
    ULONGLONG telemetry_at = 0;
    std::string last_status;
    ImVec2 position = ImVec2(32, 32);
    // Draw size as a multiple of the panel's own pixels. Read from
    // ReShade.ini on the first frame and written back when a drag ends.
    float scale = 0.f;
    bool sizing = false;
};
std::unordered_map<reshade::api::effect_runtime *, std::unique_ptr<surface>> surfaces;
bool registered = false;
constexpr float min_scale = 0.75f, max_scale = 2.5f;
// Stored as a whole percentage so it survives ReShade's own int handling
// and stays readable to anyone who opens ReShade.ini.
float load_scale(reshade::api::effect_runtime *runtime) {
    int percent = 0;
    if (!reshade::get_config_value(runtime, "DLSS5Swapper", "PanelScale", percent) || percent <= 0) return 1.f;
    return std::clamp(percent / 100.f, min_scale, max_scale);
}
void save_scale(reshade::api::effect_runtime *runtime, float scale) {
    reshade::set_config_value(runtime, "DLSS5Swapper", "PanelScale", int(scale * 100.f + 0.5f));
}
ImVec2 vector_call(ImVec2 (*fn)()) { ImVec2 result; lab_imgui_vec2(reinterpret_cast<void *>(fn), &result.x, &result.y); return result; }
void release_texture(reshade::api::effect_runtime *runtime, surface &s) {
    if (!s.texture.handle) return;
    runtime->get_command_queue()->flush_immediate_command_list();
    runtime->get_command_queue()->wait_idle();
    auto device = runtime->get_device();
    if (s.view.handle) device->destroy_resource_view(s.view);
    device->destroy_resource(s.texture); s.texture = {}; s.view = {}; s.uploaded = 0; s.texture_height = 0;
}
void destroy(reshade::api::effect_runtime *runtime) {
    auto it = surfaces.find(runtime);
    if (it == surfaces.end()) return;
    release_texture(runtime, *it->second); surfaces.erase(it);
}
surface &state_for(reshade::api::effect_runtime *runtime) {
    auto &ptr = surfaces[runtime]; if (!ptr) ptr = std::make_unique<surface>();
    return *ptr;
}
void draw(reshade::api::effect_runtime *runtime) {
    auto &s = state_for(runtime); auto &bridge = s.bridge;
    bridge.poll();
    if (s.live.dirty) { s.live.discover(runtime); s.last_status.clear(); }
    for (const auto &command : bridge.commands) {
        const bool applied = command.id >= 301 ? (bridge.feed_peer && s.feed.accept(s.live.epoch,command)) : command.id >= 101 ? (bridge.nr_peer && s.nr.accept(s.live.epoch, command)) : s.live.apply(runtime, command);
#ifdef LAB_OVERLAY_SMOKE
        if (applied) reshade::log::message(reshade::log::level::info, "LAB_LIVE_COMMAND_APPLIED");
#endif
        s.last_status.clear();
    }
    bridge.commands.clear();
    if (bridge.connected() && bridge.nr_peer) s.nr.tick(runtime);
    if (bridge.connected() && bridge.feed_peer) s.feed.tick(runtime->get_device()->get_api()==reshade::api::device_api::d3d11);
    if (bridge.connected() && bridge.live_peer && GetTickCount64() >= s.telemetry_at) {
        s.telemetry_at = GetTickCount64() + 200;
        auto json = s.live.status(runtime);
        if (bridge.nr_peer) { json.pop_back(); json += s.nr.json() + "}"; }
        if (bridge.feed_peer) { json.pop_back(); json += s.feed.json() + "}"; }
        if (json != s.last_status) {
#ifdef LAB_OVERLAY_SMOKE
            reshade::log::message(reshade::log::level::info,("LAB_STATUS epoch="+std::to_string(s.live.epoch)+" size="+std::to_string(json.size())).c_str());
#endif
            bridge.status(json); s.last_status = json;
        }
    }
    if (!bridge.connected() || bridge.pixels.empty()) {
        release_texture(runtime, s); s.dragging = s.focused = s.hovered = false; s.last_status.clear();
        ImGui::TextWrapped("DLSS 5 Swapper must remain open. Waiting for the shared panel design (one test game at a time)...");
        return;
    }
    if (s.uploaded != bridge.sequence) {
        using namespace reshade::api;
        auto device = runtime->get_device();
        subresource_data data = { bridge.pixels.data(), panel_width * 4, panel_width * bridge.height * 4 };
        if (s.texture.handle && s.texture_height == bridge.height) {
            device->update_texture_region(data, s.texture, 0, nullptr);
        } else {
            release_texture(runtime, s);
            const resource_desc desc(panel_width, bridge.height, 1, 1, format::b8g8r8a8_unorm, 1, memory_heap::default_, resource_usage::shader_resource);
            if (!device->create_resource(desc, &data, resource_usage::shader_resource, &s.texture) ||
                !device->create_resource_view(s.texture, resource_usage::shader_resource, resource_view_desc(format::b8g8r8a8_unorm), &s.view)) {
                release_texture(runtime, s); ImGui::TextUnformatted("The renderer could not create the panel surface."); return;
            }
            s.texture_height = bridge.height;
        }
        s.uploaded = bridge.sequence;
    }
    const auto origin = vector_call(imgui_function_table_instance()->GetCursorScreenPos);
    if (s.scale <= 0.f) s.scale = load_scale(runtime);
    const float width = panel_width * s.scale, drawn = bridge.height * s.scale;
    // The panel's own pixels are still 1:1 with what the app drew; only the
    // rectangle they are stretched into changes, so fonts and sliders never
    // inherit ReShade's font or scaling.
    ImGui::InvisibleButton("##lab-shared-panel", ImVec2(width, drawn));
    ImGui::GetWindowDrawList()->AddImage(ImTextureRef(static_cast<ImTextureID>(s.view.handle)), origin, ImVec2(origin.x + width, origin.y + drawn));
    const auto &io = ImGui::GetIO();
    const bool hovered = ImGui::IsItemHovered();
    // Back into the panel's own coordinates: the app knows nothing about the
    // size it is being drawn at, and a click has to land where it looks.
    const int x = static_cast<int>((io.MousePos.x - origin.x) / s.scale), y = static_cast<int>((io.MousePos.y - origin.y) / s.scale);
    // A grip in the bottom right corner, drawn over the panel's own pixels.
    // Dragging it sets the size; ReShade.ini remembers it for this game.
    const float grip = 18.f;
    const ImVec2 corner(origin.x + width, origin.y + drawn);
    ImGui::SetCursorScreenPos(ImVec2(corner.x - grip, corner.y - grip));
    ImGui::InvisibleButton("##lab-panel-grip", ImVec2(grip, grip));
    const bool on_grip = ImGui::IsItemHovered() || s.sizing;
    auto *list = ImGui::GetWindowDrawList();
    const ImU32 ink = on_grip ? IM_COL32(255, 255, 255, 220) : IM_COL32(255, 255, 255, 90);
    for (int i = 1; i <= 3; ++i) {
        const float step = i * 5.f;
        list->AddLine(ImVec2(corner.x - step, corner.y - 2.f), ImVec2(corner.x - 2.f, corner.y - step), ink, 1.5f);
    }
    // Never let it grow past the screen: the grip lives in the panel's bottom
    // right corner, and a panel taller than the display would take the grip off
    // with it, leaving no way to make it small again.
    const float fits = std::min(io.DisplaySize.x / panel_width, io.DisplaySize.y / float(bridge.height));
    const float ceiling = std::max(min_scale, std::min(fits, max_scale));
    if (s.scale > ceiling) s.scale = ceiling;
    if (ImGui::IsItemActive()) {
        s.sizing = true;
        // Follow the corner the pointer is actually dragging, along the
        // diagonal, so the panel keeps its shape.
        const float wanted = (io.MousePos.x - origin.x) / panel_width;
        s.scale = std::clamp(wanted, min_scale, ceiling);
    } else if (s.sizing) {
        s.sizing = false;
        save_scale(runtime, s.scale);
    }
    if (s.sizing || on_grip) return;
    if (hovered && y < 52 && x < 320 && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) s.moving = true;
    if (s.moving) {
        if (!ImGui::IsMouseDown(ImGuiMouseButton_Left)) s.moving = false;
        else { s.position.x += io.MouseDelta.x; s.position.y += io.MouseDelta.y; }
        return;
    }
    if ((hovered || s.dragging || s.hovered) && (x != s.last_x || y != s.last_y)) {
        bridge.send(1, std::clamp(x, -8192, 8192), std::clamp(y, -8192, 8192)); s.last_x = x; s.last_y = y;
    }
    s.hovered = hovered;
    if (ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
        s.focused = hovered;
        if (hovered) { s.dragging = true; bridge.send(2, x, y); }
    }
    if (s.dragging && !ImGui::IsMouseDown(ImGuiMouseButton_Left)) { bridge.send(3, std::clamp(x, -8192, 8192), std::clamp(y, -8192, 8192)); s.dragging = false; }
    if (hovered && io.MouseWheel != 0) bridge.send(4, x, y, std::clamp(int(io.MouseWheel * 100), -1200, 1200));
    if (s.focused) {
        const ImGuiKey keys[] = {ImGuiKey_Tab, ImGuiKey_LeftArrow, ImGuiKey_RightArrow, ImGuiKey_UpArrow, ImGuiKey_DownArrow, ImGuiKey_Space, ImGuiKey_Enter};
        for (int i = 0; i < 7; ++i) if (ImGui::IsKeyPressed(keys[i])) bridge.send(5, 0, 0, i == 0 && io.KeyShift ? 7 : i);
        if (bridge.nr_peer) {
            if (ImGui::IsKeyPressed(ImGuiKey_Backspace)) bridge.send(5, 0, 0, 8);
            if (ImGui::IsKeyPressed(ImGuiKey_Delete)) bridge.send(5, 0, 0, 9);
            if (io.KeyCtrl && ImGui::IsKeyPressed(ImGuiKey_A)) bridge.send(5, 0, 0, 10);
            if (!io.KeyCtrl && !io.KeyAlt && !io.KeyShift) {
                for (int i = 0; i < 10; ++i)
                    if (ImGui::IsKeyPressed(static_cast<ImGuiKey>(ImGuiKey_0 + i)) || ImGui::IsKeyPressed(static_cast<ImGuiKey>(ImGuiKey_Keypad0 + i))) bridge.send(5, 0, 0, 11 + i);
                if (ImGui::IsKeyPressed(ImGuiKey_Period) || ImGui::IsKeyPressed(ImGuiKey_KeypadDecimal)) bridge.send(5, 0, 0, 21);
                if (ImGui::IsKeyPressed(ImGuiKey_Minus) || ImGui::IsKeyPressed(ImGuiKey_KeypadSubtract)) bridge.send(5, 0, 0, 22);
            }
        }
    }
#ifdef LAB_OVERLAY_SMOKE
    static bool logged = false;
    if (!logged) { reshade::log::message(reshade::log::level::info, "LAB_SMOKE_SHARED_SURFACE_DRAWN"); logged = true; }
#endif
}
void reloaded(reshade::api::effect_runtime *runtime) { state_for(runtime).live.dirty = true; }
void controls(reshade::api::effect_runtime *runtime) {
    auto &s = state_for(runtime);
    ImGui::TextWrapped("Optional compact overlay. Choose its hotkey on the Overlay page in DLSS 5 Swapper (default F8). Home keeps the original tools available.");
    if (ImGui::Button("Open compact overlay")) { s.open = true; runtime->open_overlay(false, reshade::api::input_source::none); }
    ImGui::TextWrapped("Keep DLSS 5 Swapper open. Drag the panel header to move it. Escape closes only the compact panel. While the panel is open the game receives no mouse or keyboard input.");
    ImGui::TextWrapped("The compact panel automatically connects to the verified v4.7 build using an experimental adapter. It redirects RenoDX's UI dispatch temporarily; unsupported builds are refused. Original settings are saved by RenoDX.");
}
void compact_draw(reshade::api::effect_runtime *runtime) {
#ifdef LAB_RENODX_PROBE
    nr_probe::tick(runtime);
#endif
    auto &s = state_for(runtime);
    s.hotkey.poll();
    if (s.hotkey.pressed(runtime)) s.open = !s.open;
#ifdef LAB_OVERLAY_SMOKE
    s.open = true; s.position = ImVec2(0, 0);
#endif
    if (s.open && runtime->is_key_pressed(VK_ESCAPE)) { s.open = false; runtime->block_input_next_frame(); }
    if (s.open != s.was_open) {
        s.was_open = s.open;
        if (s.bridge.connected()) {
            s.bridge.send(6, 0, 0, s.open ? 1 : 0);
        }
    }
    if (!s.open) {
        if (s.bridge.connected()) { s.bridge.poll(); }
        s.dragging = s.moving = s.focused = false;
        return;
    }
    auto &io = ImGui::GetIO();
#ifndef LAB_OVERLAY_SMOKE
    io.MouseDrawCursor = true;
#endif
    // ReShade holds the game's input for as long as its own overlay is up, and
    // an open panel means the same here: the camera must not follow the mouse,
    // or a slider cannot be judged against one fixed shot. Blocking only while
    // the pointer sat over the panel swung the view away the moment it left.
    // Escape and the hotkey still arrive: ReShade keeps reading input for
    // itself while it withholds it from the game.
    runtime->block_input_next_frame();
    if (s.scale <= 0.f) s.scale = load_scale(runtime);
    const float height = std::min(float(s.bridge.height ? s.bridge.height : 806) * s.scale, std::max(120.f, io.DisplaySize.y));
    const float window_width = panel_width * s.scale;
    s.position.x = std::clamp(s.position.x, 0.f, std::max(0.f, io.DisplaySize.x - window_width));
    s.position.y = std::clamp(s.position.y, 0.f, std::max(0.f, io.DisplaySize.y - height));
    ImGui::SetNextWindowDockID(0, ImGuiCond_Always);
    ImGui::SetNextWindowPos(s.position, ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(window_width, height), ImGuiCond_Always);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(0, 0));
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.f);
    if (ImGui::Begin("##DLSSLabCompact", nullptr, ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoDocking | ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoSavedSettings)) {
        draw(runtime);
    }
    ImGui::End(); ImGui::PopStyleVar(2);
}
}
extern "C" __declspec(dllexport) bool AddonInit(HMODULE addon, HMODULE reshade_module) {
    if (registered) return true;
    if (!reshade::register_addon(addon, reshade_module)) return false;
    reshade::register_overlay("DLSS 5 Swapper", controls);
    reshade::register_event<reshade::addon_event::destroy_effect_runtime>(destroy);
    reshade::register_event<reshade::addon_event::reshade_reloaded_effects>(reloaded);
    reshade::register_event<reshade::addon_event::reshade_overlay>(compact_draw);
    registered = true;
    reshade::log::message(reshade::log::level::info, "DLSS 5 Swapper shared surface registered. RenoDX v4.7 UI adapter connects automatically, is experimental and hash-pinned. Keep DLSS 5 Swapper open.");
    return true;
}
extern "C" __declspec(dllexport) void AddonUninit(HMODULE addon, HMODULE reshade_module) {
    if (!registered) return;
    reshade::unregister_event<reshade::addon_event::reshade_overlay>(compact_draw);
    reshade::unregister_event<reshade::addon_event::destroy_effect_runtime>(destroy);
    reshade::unregister_event<reshade::addon_event::reshade_reloaded_effects>(reloaded);
    reshade::unregister_overlay("DLSS 5 Swapper", controls);
    while (!surfaces.empty()) destroy(surfaces.begin()->first);
    reshade::unregister_addon(addon, reshade_module); registered = false;
}
