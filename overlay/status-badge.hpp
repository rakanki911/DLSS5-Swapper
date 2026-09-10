#pragma once
#include <cstdio>
// A small always-on card saying whether the neural pass is actually running.
// The picture alone does not tell you - that is the whole point of the feature -
// so anyone recording a comparison has no way to show a viewer which half is
// which. This is that proof, drawn over the game and caught by any recorder.
//
// Deliberately not part of the compact panel: the panel is for changing things
// and is closed while you play, and this has to be visible exactly then.
// Declared in overlay.cpp's translation unit; defined in imgui-abi.cpp, which
// is compiled with ReShade's own ABI. Any ImGui call that returns an ImVec2 has
// to come back through there.
extern "C" void lab_imgui_text_size(void *, const char *, float *, float *);

namespace lab_badge {

inline ImVec2 text_size(const char *text) {
    float x = 0.f, y = 0.f;
    lab_imgui_text_size(reinterpret_cast<void *>(imgui_function_table_instance()->CalcTextSize), text, &x, &y);
    return ImVec2(x, y);
}

// Unscaled geometry. The bar under the card carries the colour, so the state
// stays readable in a thumbnail where the text is not.
constexpr float card_w = 224.f, card_h = 46.f, bar_h = 7.f, round = 4.f;
constexpr float min_scale = 0.6f, max_scale = 3.f, grip = 20.f, reach = 26.f;

struct badge {
    bool shown = false;
    float scale = 1.f;
    // Placed on the first frame that knows the screen size. The panel opens at
    // the top left, so the card starts at the bottom left instead - they used
    // to default to the same corner and the card appeared under its own switch.
    ImVec2 position = ImVec2(-1.f, -1.f);
    bool moving = false, sizing = false;
    float grab = 0.f;
    bool loaded = false, dirty = false, placed = false;
    // The click that ticks the switch in the panel is still down when the card
    // appears under it. Without this the card took that same press as the start
    // of a drag - and, with input blocked, there was no way back.
    bool armed = false;
    ULONGLONG report_at = 0;

    template<class Runtime> void load(Runtime *runtime) {
        if (loaded) return;
        loaded = true;
        int on = 0, percent = 0, x = 0, y = 0;
        if (reshade::get_config_value(runtime, "DLSS5Swapper", "BadgeOn", on)) shown = on != 0;
        if (reshade::get_config_value(runtime, "DLSS5Swapper", "BadgeScale", percent) && percent > 0)
            scale = std::clamp(percent / 100.f, min_scale, max_scale);
        if (reshade::get_config_value(runtime, "DLSS5Swapper", "BadgeX", x) &&
            reshade::get_config_value(runtime, "DLSS5Swapper", "BadgeY", y) && x >= 0 && y >= 0) {
            position = ImVec2(float(x), float(y)); placed = true;
        }
    }
    template<class Runtime> void save(Runtime *runtime) {
        if (!dirty) return;
        dirty = false;
        reshade::set_config_value(runtime, "DLSS5Swapper", "BadgeOn", shown ? 1 : 0);
        reshade::set_config_value(runtime, "DLSS5Swapper", "BadgeScale", int(scale * 100.f + 0.5f));
        reshade::set_config_value(runtime, "DLSS5Swapper", "BadgeX", int(position.x + 0.5f));
        reshade::set_config_value(runtime, "DLSS5Swapper", "BadgeY", int(position.y + 0.5f));
    }
    void set(bool on) { if (shown != on) { shown = on; dirty = true; armed = false; moving = sizing = false; } }

    // `interactive` is true only while a panel already owns the mouse. The card
    // never takes input from the game: it is there to be seen in a recording,
    // and a thing that is always on screen must never be able to eat a click.
    void draw(bool running, bool interactive) {
        if (!shown) { armed = false; moving = sizing = false; return; }
        const auto &io = ImGui::GetIO();
        // The card is sized around the label at the font ReShade is already
        // using. Nothing here asks ImGui to draw at another size: in 1.92 fonts
        // are baked on demand, and AddText with a size of our own choosing read
        // a null inside ReShade and took the game down with it.
        const ImVec2 label = text_size(running ? "DLSS 5 On" : "DLSS 5 Off");
        const float bar = bar_h * scale;
        const float w = std::max(card_w * scale, label.x + 34.f);
        const float h = std::max(card_h * scale, label.y + 20.f + bar);
        if (!placed && io.DisplaySize.y > 1.f) {
            placed = true;
            // Bottom right: the panel opens down the left side, so this is
            // the one corner it can never reach.
            if (position.x < 0.f) position = ImVec2(std::max(0.f, io.DisplaySize.x - w - 28.f), std::max(0.f, io.DisplaySize.y - h - 28.f));
        }
        // Never let it be dragged or scaled off the screen: a card you cannot
        // reach is a card you cannot turn off again.
        const float ceiling = std::max(min_scale, std::min(max_scale,
            std::min(io.DisplaySize.x / card_w, io.DisplaySize.y / card_h)));
        if (scale > ceiling) scale = ceiling;
        position.x = std::clamp(position.x, 0.f, std::max(0.f, io.DisplaySize.x - w));
        position.y = std::clamp(position.y, 0.f, std::max(0.f, io.DisplaySize.y - h));

        const ImVec2 tl = position, br = ImVec2(position.x + w, position.y + h);
        const bool near_card = interactive && io.MousePos.x > tl.x - reach && io.MousePos.x < br.x + reach &&
                               io.MousePos.y > tl.y - reach && io.MousePos.y < br.y + reach;
        const bool over_card = interactive && io.MousePos.x >= tl.x && io.MousePos.x <= br.x &&
                               io.MousePos.y >= tl.y && io.MousePos.y <= br.y;
        const bool over_grip = over_card && io.MousePos.x >= br.x - grip && io.MousePos.y >= br.y - grip;

        // Its own window, taking no input of its own: every hit test here is
        // against the pointer directly, so nothing can swallow a press the way
        // one large invisible button swallowed the panel's own resize grip.
        ImGui::SetNextWindowPos(tl, ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(w, h), ImGuiCond_Always);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(0, 0));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.f);
        const bool open = ImGui::Begin("##DLSS5StatusBadge", nullptr,
            ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoScrollbar |
            ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoSavedSettings |
            ImGuiWindowFlags_NoDocking | ImGuiWindowFlags_NoFocusOnAppearing |
            ImGuiWindowFlags_NoBringToFrontOnFocus | ImGuiWindowFlags_NoInputs);
        if (open) {
            auto *list = ImGui::GetWindowDrawList();
            // On is a light card with a green bar; off is a dark card with a
            // dead one. Both read over any game, and stay apart at a glance in
            // a compressed video.
            const ImU32 face = running ? IM_COL32(255, 255, 255, 242) : IM_COL32(18, 20, 24, 208);
            const ImU32 ink  = running ? IM_COL32(14, 16, 18, 255)    : IM_COL32(255, 255, 255, 235);
            const ImU32 lamp = running ? IM_COL32(143, 212, 0, 255)   : IM_COL32(58, 61, 66, 235);
            list->AddRectFilled(tl, ImVec2(br.x, br.y - bar), face, round * scale, ImDrawFlags_RoundCornersTop);
            list->AddRectFilled(ImVec2(tl.x, br.y - bar), br, lamp, round * scale, ImDrawFlags_RoundCornersBottom);

            // The plain overload only: current font, current size, no font
            // machinery of any kind.
            list->AddText(ImVec2(tl.x + (w - label.x) * .5f, tl.y + (h - bar - label.y) * .5f), ink,
                          running ? "DLSS 5 On" : "DLSS 5 Off");

            // The grip exists only while the pointer is near, so a recording of
            // a card nobody is touching carries no furniture.
            if (near_card || moving || sizing) {
                list->AddRect(tl, br, IM_COL32(255, 255, 255, running ? 70 : 90), round * scale);
                const ImU32 marks = (over_grip || sizing) ? IM_COL32(255, 255, 255, 235)
                                  : running ? IM_COL32(20, 22, 26, 150) : IM_COL32(255, 255, 255, 130);
                for (int i = 1; i <= 3; ++i) {
                    const float step = i * 5.f * std::min(scale, 2.f);
                    list->AddLine(ImVec2(br.x - step, br.y - 2.f), ImVec2(br.x - 2.f, br.y - step), marks, 1.5f);
                }
            }
        }
        ImGui::End();
        ImGui::PopStyleVar(2);

        if (near_card || moving || sizing)
            ImGui::SetMouseCursor(over_grip || sizing ? ImGuiMouseCursor_ResizeNWSE : ImGuiMouseCursor_Hand);

        if (sizing) {
            if (!ImGui::IsMouseDown(ImGuiMouseButton_Left)) { sizing = false; dirty = true; }
            else scale = std::clamp((io.MousePos.x + grab - position.x) / card_w, min_scale, ceiling);
        } else if (moving) {
            if (!ImGui::IsMouseDown(ImGuiMouseButton_Left)) { moving = false; dirty = true; }
            else { position.x += io.MouseDelta.x; position.y += io.MouseDelta.y; }
        } else if (over_grip && armed && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
            sizing = true; grab = br.x - io.MousePos.x;
        } else if (over_card && armed && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
            moving = true;
        }
        // Arming is checked alongside the click rather than instead of it: as
        // its own branch it swallowed the first press of every session.
        if (!armed && !ImGui::IsMouseDown(ImGuiMouseButton_Left)) armed = true;

        // One line a second while the pointer is in play, at debug level so it
        // stays in the log file and never appears over the game. If dragging
        // still does nothing, this says which of the three conditions failed.
        if (GetTickCount64() >= report_at) {
            report_at = GetTickCount64() + 1000;
            char line[220];
            snprintf(line, sizeof(line),
                "LAB_BADGE display=%.0fx%.0f fb=%.2f interactive=%d armed=%d mouse=%.0f,%.0f card=%.0f,%.0f..%.0f,%.0f over=%d grip=%d moving=%d sizing=%d",
                io.DisplaySize.x, io.DisplaySize.y, io.DisplayFramebufferScale.x,
                interactive ? 1 : 0, armed ? 1 : 0, io.MousePos.x, io.MousePos.y,
                tl.x, tl.y, br.x, br.y, over_card ? 1 : 0, over_grip ? 1 : 0, moving ? 1 : 0, sizing ? 1 : 0);
            reshade::log::message(reshade::log::level::debug, line);
        }
    }
};
}
