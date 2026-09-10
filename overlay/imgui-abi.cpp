// Header-free MSVC ABI thunk: ReShade returns non-POD ImVec2 differently
// from MinGW. This object has no CRT dependencies and exposes only a C ABI.
extern "C" int _fltused = 0; // MSVC's floating-point marker; no CRT is linked.
struct ImVec2 {
    float x, y;
    constexpr ImVec2() : x(0), y(0) {}
    constexpr ImVec2(float a, float b) : x(a), y(b) {}
};
extern "C" void lab_imgui_vec2(void *function, float *x, float *y) {
    const auto value = reinterpret_cast<ImVec2(*)()>(function)();
    *x = value.x; *y = value.y;
}

// Same reason, for the one ImVec2-returning call that takes arguments. Calling
// it directly from the MinGW-built add-on returns the struct by the wrong
// convention and ReShade reads a null - a crash inside dxgi.dll whose stack
// names this add-on, in every game, on the first frame that measures text.
extern "C" void lab_imgui_text_size(void *function, const char *text, float *x, float *y) {
    const auto value = reinterpret_cast<ImVec2(*)(const char *, const char *, bool, float)>(function)(text, nullptr, false, -1.f);
    *x = value.x; *y = value.y;
}
