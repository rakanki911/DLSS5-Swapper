// UI-only adapter for two exact, unmodified add-on files. No shared ReShade
// table is edited, no rendering/settings offsets are read or written, and no
// foreign replacement is chained. Only each verified add-on's table slot is
// changed, by compare/exchange, to this lifetime-stable copy of the original.
#pragma once
#include "renodx-ui-probe.hpp"
#include <cstdarg>
#include <mutex>

namespace native_i18n {
struct entry { const char *en, *zh; };
inline const entry words[] = {
    {"Enabled", "启用"}, {"Status", "状态"}, {"Inert", "停用"},
    {"not present", "未加载"}, {"Sharpness", "锐度"}, {"not checked yet", "尚未检查"}, {"Depth", "深度"},
    {"no depth probe yet (first one after 600 frames)", "尚未检查深度（首次检查在 600 帧后）"},
    {"Intensity", "强度"}, {"Transfer", "转换"}, {"Color", "颜色"}, {"slew", "渐变限制"}, {"stable", "稳定"},
    {" (reference match)", "（与参考版本一致）"},
    {"Restore erases every setting for this game - strengths, codec, resolution, passes, and hotkeys.", "恢复操作会清除此游戏的全部设置，包括强度、颜色转换、分辨率、处理次数和快捷键。"},
    {"Confirm: restore defaults", "确认：恢复默认值"}, {"Cancel", "取消"}, {"Hotkeys", "快捷键"},
    {"NR Toggle Key", "神经渲染开关按键"}, {"Screenshot Key", "截图按键"}, {"NR toggle", "神经渲染开关"}, {"screenshot", "截图"},
    {"Capture Screenshot (%s)", "截取画面（%s）"}, {"waiting for GPU completion", "正在等待 GPU 完成"},
    {"armed, waiting for a successful evaluation", "已就绪，等待成功处理一次画面"}, {"idle", "空闲"},
    {"Screenshot (%s): %s", "截图（%s）：%s"},
    {"FAILED TO COMPILE", "编译失败"}, {"DISABLED", "已关闭"}, {"not installed", "未安装"},
    {"DLSS5_MV_PROVIDER=%d (%s) -> %s (%s)", "DLSS5_MV_PROVIDER=%d（%s）→ %s（%s）"},
    {"absent (older shader: no bias mask)", "缺少（旧版着色程序没有偏差遮罩）"},
    {"DLSS5_Feed.fx is compiled for motion-vector provider %d (%s) but no known %s shader is installed: motion vectors will be zero (still images only). Install one, or change the DLSS5_MV_PROVIDER preprocessor definition.", "DLSS5_Feed.fx 使用运动矢量来源 %d（%s）编译，但未安装已知的 %s 着色程序；运动矢量将为零（只能处理静止画面）。请安装相应来源，或修改 DLSS5_MV_PROVIDER 预处理定义。"},
    {"motion-vector provider %s FAILED TO COMPILE, so it writes nothing and DLSS runs on zero vectors. ReShade.log: %s -- use another provider (VORT: DLSS5_MV_PROVIDER=2).", "运动矢量来源 %s 编译失败，没有输出，DLSS 使用零运动矢量运行。ReShade.log：%s。请改用其他来源（VORT：DLSS5_MV_PROVIDER=2）。"},
    {"motion-vector provider %s is installed but DISABLED: enable it above DLSS 5 Feed.", "运动矢量来源 %s 已安装但被关闭，请在 DLSS 5 Feed 上方启用它。"},
    {"%s%s is enabled, but DLSS5_Feed.fx is compiled for provider %d (%s) and does not read it -- set the DLSS5_MV_PROVIDER preprocessor definition to %d to use it.", "%s%s 已启用，但 DLSS5_Feed.fx 使用来源 %d（%s）编译，无法读取它；如需使用，请将 DLSS5_MV_PROVIDER 预处理定义设为 %d。"},
    {"resource build failed at %d%% work resolution -- try work_resolution=100", "在 %d%% 处理分辨率下创建资源失败，可尝试 work_resolution=100"},
    {"preparing work-resolution inputs", "正在准备处理分辨率输入"}, {"running the D3D12 evaluate", "正在执行 D3D12 处理"},
    {"raised exception", "发生异常"}, {"D3D12 result wait", "等待 D3D12 结果"},
    {"the Vulkan transport faulted (the feed is off; the game keeps running)", "Vulkan 传输发生故障（数据传送已关闭，游戏继续运行）"},
    {"only Direct3D 11/12, Vulkan and OpenGL games are supported", "仅支持 Direct3D 11/12、Vulkan 和 OpenGL 游戏"},
    {"DLSS5_Feed.fx is not loaded (technique/textures missing) -- install it into reshade-shaders\\Shaders.", "未加载 DLSS5_Feed.fx（缺少效果或纹理），请安装到 reshade-shaders\\Shaders。"},
    {"Transport test (no NGX)", "传输测试（不调用 NGX）"}, {"Full DLSS path", "完整 DLSS 流程"},
    {"Auto", "自动"}, {"Force off", "强制关闭"}, {"Force on", "强制开启"},
    {"Default", "默认"}, {"E (legacy CNN)", "E（旧版 CNN 模型）"}, {"F (legacy CNN)", "F（旧版 CNN 模型）"},
    {"J (transformer)", "J（Transformer 模型）"}, {"K (transformer)", "K（Transformer 模型）"},
    {"disabled", "已关闭"}, {"open", "已开启"}, {"not started", "尚未启动"},
    {"ready", "就绪"}, {"not built", "尚未创建"}, {"not found", "未找到"},
    {"Session: %s", "会话：%s"}, {"Stopped: %s", "已停止：%s"}, {"Feature: %s", "功能：%s"},
    {"Frames delivered: %llu", "已传送帧数：%llu"},
    {"DLSS 5 add-on: %s%s (%s)", "DLSS 5 插件：%s%s（%s）"},
    {"v4.7+ engine", "v4.7 及更新引擎"}, {"v4.6 engine", "v4.6 引擎"},
    {"v45+ engine", "v45 及更新引擎"}, {"classic engine", "经典引擎"},
    {"Alex's Toolkit %s cannot attach to DLSS 5 add-on %s -- THE CASCADE IS DOING NOTHING.", "Alex's Toolkit %s 无法连接 DLSS 5 插件 %s，多次处理没有生效。"},
    {"Alex's Toolkit %s: %d-pass cascade -- ~%dx temporal history (smearing, slow settle)", "Alex's Toolkit %s：%d 次连续处理，时间历史约为 %d 倍（可能拖影、稳定较慢）"},
    {"Alex's Toolkit %s: present, cascade off (single pass)", "Alex's Toolkit %s：已加载，连续处理已关闭（单次处理）"},
    {"renodx-dlss5.addon64 is ALSO present -- Chicken stays inert while both are loaded.", "同时发现 renodx-dlss5.addon64；两者同时加载时，Chicken 不会运行。"},
    {"Keep dlss5-feed.addon64, remove one neural provider, then fully restart.", "保留 dlss5-feed.addon64，移除其中一个神经渲染组件，然后完全重启游戏。"},
    {"; [DlssNr] Enabled is OFF in OptiScaler.ini", "；OptiScaler.ini 中的 [DlssNr] Enabled 已关闭"},
    {"; neural model created", "；神经模型已创建"},
    {"; NEURAL MODEL NOT CREATED (OptiScaler.log says why)", "；神经模型尚未创建（原因见 OptiScaler.log）"},
    {"session not started yet", "会话尚未启动"}, {"NGX routed through it", "NGX 已通过此组件运行"},
    {"NOT ROUTED: the driver answered", "未转交：请求由驱动处理"},
    {"OptiScaler WITHOUT the neural-rendering fork (no neural pass)", "OptiScaler 不是神经渲染分支版本（不执行神经处理）"},
    {"Neural consumer: %s (%s) -- %s%s%s", "神经渲染组件：%s（%s）— %s%s%s"},
    {"A second neural consumer is ALSO present -- OptiScaler captures its NGX calls too.", "同时发现另一个神经渲染组件，OptiScaler 也会接管它的 NGX 调用。"},
    {"Keep exactly one (remove the other's files, or the OptiScaler set), then fully restart.", "只保留其中一个（移除另一个组件的文件或整套 OptiScaler），然后完全重启游戏。"},
    {"OptiScaler's own menu: Insert (its \"DLSS Neural Rendering\" section is the last one).", "按 Insert 打开 OptiScaler 菜单，最后一个部分是“DLSS Neural Rendering”。"},
    {"d3dcompiler_47.dll is too old for Shader Model 5.1 -- NEURAL RENDERING IS DOING NOTHING.", "d3dcompiler_47.dll 太旧，不支持 Shader Model 5.1；神经渲染没有生效。"},
    {"Delete or rename %s, then restart the game.", "删除或重命名 %s，然后重启游戏。"},
    {"Re-enable", "重新启用"}, {"DLSS contract", "DLSS 数据设置"}, {"Mode", "运行模式"},
    {"Work resolution (%)", "处理分辨率（%）"}, {"Pending: %d%%", "待应用：%d%%"},
    {"Active: %ux%u (%d%%) -> %ux%u", "当前：%ux%u（%d%%）→ %ux%u"},
    {"FSR 1 expand-back (EASU + RCAS)", "FSR 1 放大还原（EASU + RCAS）"},
    {"FSR 1 shaders failed to compile (see the log); the spatial expand-back stays bilinear.", "FSR 1 着色程序编译失败（详见日志），放大还原仍使用双线性插值。"},
    {"DLSS reconstruction active -- costs as much as 100%", "DLSS 重建已启用，开销与 100% 分辨率相同"},
    {"no DLSS preset covers this ratio; DLAA + FSR 1", "没有适用此比例的 DLSS 预设；使用 DLAA + FSR 1"},
    {"work_upscale=2 (cfg only): %s", "work_upscale=2（仅配置文件可设）：%s"},
    {"Work resolution: 100%% (adjustable path currently supports 64-bit D3D11)", "处理分辨率：100%%（目前只有 64 位 D3D11 流程支持调整）"},
    {"Depth inverted", "反转深度"}, {"Reset every frame (diagnostic)", "每帧重置（诊断用）"},
    {"Settle evaluates (extra, per frame)", "稳定画面的额外处理次数（每帧）"},
    {"Output stabiliser", "输出稳定器"}, {"Hold strength", "保持强度"}, {"Change tolerance", "变化容差"},
    {"DLSS render preset", "DLSS 渲染预设"}, {"Preset", "预设"}, {"Motion vectors", "运动矢量"},
    {"provider matches the shader's DLSS5_MV_PROVIDER", "来源与着色程序的 DLSS5_MV_PROVIDER 设置一致"},
    {"MV scale X", "运动矢量 X 轴缩放"}, {"MV scale Y", "运动矢量 Y 轴缩放"},
    {"Advanced", "高级设置"}, {"Create delay (frames)", "创建延迟（帧）"},
    {"Warm-up rebuild (frames)", "预热后重建（帧）"}, {"Raw create flags (-1 = auto)", "原始创建标记（-1 为自动）"},
    {"Log first N frames", "记录前 N 帧日志"}, {"Force one rebuild", "强制重建一次"},
    {"no motion-vector probe yet (first one after 600 frames)", "尚未检查运动矢量（首次检查在 600 帧后）"},
    {"Neural Rendering", "神经渲染"}, {"Enable DLSS Neural Rendering", "启用 DLSS 神经渲染"},
    {"SAFE MODE (all hooks off)", "安全模式（所有接入点已关闭）"},
    {"EnableHooks=0: NR disabled by policy. Set EnableHooks=2 for NGX-only NR.", "EnableHooks=0：设置已禁止神经渲染。设为 EnableHooks=2 可只通过 NGX 运行神经渲染。"},
    {"NR IS OFF", "神经渲染已关闭"}, {"WAITING FOR NGX MODULES", "正在等待 NGX 组件"},
    {"HOOKS ARMED - NO DLSS CREATE SEEN", "接入点已就绪，尚未发现 DLSS 创建请求"},
    {"DLSS CREATED - NO EVALUATIONS YET", "DLSS 已创建，尚未执行画面处理"},
    {"NO NR FEATURE MATCHED (STANDBY/FAILED)", "没有匹配的神经渲染功能（待机或失败）"},
    {"ACTIVE - NR INJECTED", "正在运行：神经渲染已接入"},
    {"RenoDX DLSS5 Generic %s | DLSSNR v310.8.0: %s", "RenoDX DLSS5 Generic %s | DLSSNR v310.8.0：%s"},
    {"Overall Intensity", "整体强度"}, {"Master strength of the neural pass.", "神经渲染处理的总强度。"},
    {"Model styling (advanced)", "模型风格（高级）"}, {"Preset #1", "预设 #1"}, {"Preset #2", "预设 #2"},
    {"Preset #3", "预设 #3"}, {"NR Preset", "神经渲染预设"}, {"Natural", "自然"},
    {"Cinematic", "电影风格"}, {"NR Style", "神经渲染风格"},
    {"Render-preset hint passed to the NR runtime; Default lets the runtime choose.", "向神经渲染组件传递预设选择；设为“默认”时由组件自行选择。"},
    {"Default = the runtime's own choice; Natural and Cinematic force that look explicitly.", "“默认”由组件自行选择；“自然”和“电影风格”会明确指定相应外观。"},
    {"Global Tone Intensity", "全局色调强度"}, {"Local Tone Intensity", "局部色调强度"},
    {"Structure Intensity", "结构强度"}, {"Character/Skin Structure", "人物与皮肤结构"},
    {"Automatic / Character Mask", "自动识别人物区域"}, {"NR UI Correction", "神经渲染界面修正"},
    {"Stacking & Resolution", "多次处理与分辨率"}, {"Denoise before upscaling (pre-SR)", "放大前去噪（pre-SR）"},
    {"NR stacking", "神经渲染多次处理"}, {"1 (single pass)", "1（单次处理）"},
    {"2 passes", "2 次处理"}, {"3 passes", "3 次处理"}, {"4 passes", "4 次处理"},
    {"NR Passes (stack)", "神经渲染处理次数"}, {"Stack pass %u", "第 %u 次处理"},
    {"HDR Transfer Strength", "HDR 转换强度"}, {"Color Strength", "颜色强度"},
    {"NR working resolution", "神经渲染处理分辨率"}, {"Native (100%)", "原生（100%）"},
    {"Follow render resolution", "跟随渲染分辨率"}, {"Scaled", "按比例缩放"},
    {"Resolution mode", "分辨率模式"}, {"Resolution scale", "分辨率比例"},
    {"Applied NR working resolution: %ux%u", "已应用的神经渲染分辨率：%ux%u"},
    {"HDR Colour Bridge", "HDR 颜色转换"}, {"Auto (recommended)", "自动（推荐）"},
    {"Classic (manual)", "经典（手动）"}, {"Anchored (manual)", "锚定（手动）"},
    {"Display (fixed)", "显示（固定）"}, {"NR Codec", "神经渲染颜色转换方式"},
    {"Normalization: fixed calibrated source (%.0f nits per unit).", "归一化：固定校准来源（每单位 %.0f 尼特）。"},
    {"off (raw candidate)", "关闭（使用原始候选值）"},
    {"Normalization: same-frame GPU autoscale, governor %s.", "归一化：同帧 GPU 自动缩放，稳定方式为 %s。"},
    {"%.1f nits", "%.1f 尼特"}, {"Proxy Anchor (nits)", "代理画面锚点（尼特）"},
    {"Source interpretation (advanced)", "来源解析（高级）"}, {"Auto (format evidence)", "自动（依据格式）"},
    {"SDR / relative", "SDR / 相对亮度"}, {"Linear", "线性"}, {"PQ / 10,000 nits", "PQ / 10,000 尼特"},
    {"Source Encoding", "来源编码"}, {"Linear Unit (nits)", "线性单位（尼特）"},
    {"Source Primaries", "来源原色"}, {"PQ Calibration", "PQ 校准"}, {"Diffuse White (nits)", "漫反射白色亮度（尼特）"},
    {"Scene Paper-White Scale", "场景基准白色比例"}, {"Chroma clamp (stops)", "色度限制（曝光档）"},
    {"Bounded ratio", "限制比例"}, {"Consistent (curve-aware)", "一致转换（考虑曲线）"},
    {"Neural transfer", "神经渲染结果转换"}, {"Off (raw per-frame)", "关闭（使用每帧原始值）"},
    {"Slew (v6.1.2)", "渐变限制（v6.1.2）"}, {"Stable (recommended)", "稳定（推荐）"},
    {"Normalization Governor", "归一化稳定方式"}, {"Governor attack (stops/s)", "变亮跟随速度（曝光档/秒）"},
    {"Governor release (stops/s)", "变暗跟随速度（曝光档/秒）"}, {"Governor slew (stops/frame)", "每帧变化限制（曝光档/帧）"},
    {"Guides & Diagnostics", "引导数据与诊断"},
    {"Guide overrides (leave at defaults unless diagnostics require them)", "引导数据覆盖（只有诊断需要时才修改默认值）"},
    {"Use game NGX flag", "使用游戏的 NGX 标记"}, {"Force normal depth", "强制普通深度"},
    {"Force inverted depth", "强制反转深度"}, {"Depth Convention", "深度规则"},
    {"Motion Scale X Multiplier", "运动矢量 X 轴倍率"}, {"Motion Scale Y Multiplier", "运动矢量 Y 轴倍率"},
    {"Chained temporal history", "各次处理保留时间历史"}, {"input res", "输入分辨率"},
    {"native (100%)", "原生（100%）"}, {"Working resolution: %s", "处理分辨率：%s"},
    {"Stack passes: %u", "处理次数：%u"}, {"NR worksets: %u", "神经渲染工作集：%u"},
    {"Successful NR frames: %llu", "神经渲染成功帧数：%llu"}, {"Bypassed NR frames: %llu", "跳过神经渲染帧数：%llu"},
    {"Last NR input: %ux%u", "最近一次输入：%ux%u"}, {"Last NR output: %ux%u", "最近一次输出：%ux%u"},
    {"Latest NR NGX result: 0x%08X (ok)", "最近一次 NGX 结果：0x%08X（正常）"},
    {"Latest NR NGX result: 0x%08X (the NR contract was rejected by this runtime build)", "最近一次 NGX 结果：0x%08X（此组件版本拒绝了神经渲染数据约定）"},
    {"Latest NR NGX result: 0x%08X (NGX failure; ReShade.log names the failing step and the fix)", "最近一次 NGX 结果：0x%08X（NGX 失败；失败步骤及解决办法见 ReShade.log）"},
    {"NGX core", "NGX 核心"}, {"signed runtime", "已签名组件"}, {"Backend: %s", "执行组件：%s"},
    {" (custom build)", "（自定义版本）"}, {"Runtime sha256: %s%s", "组件 SHA-256：%s%s"},
    {"NGX modules detoured: %d", "已接入的 NGX 组件：%d"}, {"yes", "是"}, {"no", "否"},
    {"NGX core present: %s", "NGX 核心已加载：%s"}, {"NGX hooks - creates: %llu", "NGX 接入：创建次数 %llu"},
    {"NGX hooks - evaluations: %llu", "NGX 接入：处理次数 %llu"},
    {"Streamline - DLSS/DLSSD evaluations: %llu", "Streamline：DLSS/DLSSD 处理次数 %llu"},
    {"Streamline - all evaluations: %llu", "Streamline：全部处理次数 %llu"},
    {"Streamline - tag calls: %llu", "Streamline：标记调用次数 %llu"},
    {"Streamline - largest tag batch: %u", "Streamline：最大标记批次 %u"},
    {"Streamline - frame mask: 0x%02X", "Streamline：帧标记 0x%02X"},
    {"Streamline - direct fallback attempts: %llu", "Streamline：直接备用调用尝试次数 %llu"},
    {"Streamline - direct fallback successes: %llu", "Streamline：直接备用调用成功次数 %llu"},
    {"GPU stage timers (profiling)", "GPU 各阶段计时（性能分析）"},
    {"GPU stage timings [%s %ux%u]: total %.2fms, model %.2fms, own overhead %.2fms", "GPU 阶段计时 [%s %ux%u]：总计 %.2fms，模型 %.2fms，自身开销 %.2fms"},
    {"  encode %.3f | resolve %.3f | linearize+scale %.3f | commit %.3f | copies+park %.3f (ms)", "  编码 %.3f | 解析 %.3f | 线性化与缩放 %.3f | 提交 %.3f | 复制与暂存 %.3f（ms）"},
    {"Reset NR feature and clear failure latch", "重置神经渲染功能并清除失败状态"},
    {"Restore all settings to defaults", "将全部设置恢复为默认值"},
    {"all settings restored to the built-in defaults", "全部设置已恢复为内置默认值"},
    {": press a key... (Esc or click to cancel)", "：请按一个键…（按 Esc 或点击取消）"},
    {"Whole-image tone/relighting strength of the neural pass. Community sweet spot is 1.00-1.05.", "神经渲染对整个画面的色调与光照调整强度。社区常用范围是 1.00–1.05。"},
    {"Structure response on skin/character regions: negative smooths, positive enhances (0 = neutral).", "皮肤与人物区域的结构响应：负值使其更平滑，正值增强细节，0 为中性。"},
    {"Let the runtime detect characters automatically so the Character/Skin Structure response applies to them.", "让组件自动识别人物，使“人物与皮肤结构”的调整应用于这些区域。"},
    {"2+ passes are stateless by default and can flicker; try the chained-history toggle in Guides & Diagnostics.", "默认情况下，第 2 次及之后的处理不保留状态，可能闪烁；可尝试“引导数据与诊断”中的时间历史选项。"},
    {"Pass 1 keeps temporal history; passes 2+ are reset every frame (stateless refinement - no accumulation).", "第 1 次处理保留时间历史；第 2 次及之后的处理每帧重置（不累积的无状态细化）。"},
    {"Used only for calibrated absolute HDR. Relative HDR uses the current frame's GPU-derived scale.", "仅用于已校准的绝对 HDR。相对 HDR 使用 GPU 从当前帧计算的比例。"},
    {"Nits per 1.0 of a linear source: 0 keeps it relative (GPU autoscale); a positive value marks it calibrated/absolute.", "线性来源每 1.0 单位对应的尼特数：0 表示相对亮度（GPU 自动缩放），正值表示已校准的绝对亮度。"},
    {"Advisory label only - the neural model works in wide gamut and no conversion is applied.", "这里只作提示；神经模型在宽色域中运行，不进行颜色转换。"},
    {"How fast the divisor may rise when the frame gets brighter (toward the proxy's clipping shoulder).", "画面变亮时，归一化除数允许上升的速度（靠近代理画面的高光截断区）。"},
    {"How fast the divisor may relax when the frame gets darker.  Slow by design: a darker proxy is harmless, a pumping one is not.", "画面变暗时，归一化除数允许回落的速度。这里刻意设置得较慢：代理画面偏暗比亮度反复波动更可接受。"},
    {"NR was switched off (ini, overlay, or the NR toggle hotkey). To turn it on, tick 'Enable DLSS Neural Rendering' above or press the NR toggle key in gameplay.", "神经渲染已通过配置文件、面板或快捷键关闭。勾选上方“启用 DLSS 神经渲染”，或在游戏中按相应快捷键即可开启。"},
    {"No NGX module loaded yet. Start the game / load into a level; the hook reattaches every present. If this never clears, the game does not use NGX DLSS.", "尚未加载 NGX 组件。启动游戏或进入关卡后，接入点会在每次显示画面时重新连接。如果一直如此，游戏可能不使用 NGX DLSS。"},
    {"NGX exports are detoured but the game has not created a DLSS/DLSSD feature. Enable DLSS in-game, or the game reaches DLSS through a path the addon cannot see (try EnableHooks=1 only if NGX-only yields no NR).", "NGX 接口已接入，但游戏尚未创建 DLSS/DLSSD 功能。请在游戏中开启 DLSS；也可能游戏使用了此插件无法识别的流程。只有仅 NGX 模式无法运行神经渲染时，才尝试 EnableHooks=1。"},
    {"Game created a DLSS feature but has not evaluated it. Begin rendering frames with DLSS active.", "游戏已经创建 DLSS 功能，但尚未执行处理。请开始在开启 DLSS 的情况下渲染画面。"},
    {"DLSS is evaluating but the NR feature did not bind to an output. Check 'Latest NR NGX result' in Guides & Diagnostics; a non-zero code means the signed NR runtime failed to initialize (driver/runtime version), and ReShade.log names the failing step with a fix.", "DLSS 正在处理，但神经渲染尚未连接到输出。请查看“引导数据与诊断”的“最近一次 NGX 结果”；非零代码表示已签名的神经渲染组件初始化失败（与驱动或组件版本有关），ReShade.log 会记录失败步骤和解决办法。"},
    {"DLSS Neural Rendering is live, denoising the game's DLSS input color before the game's own DLSS evaluate (pre-SR).", "DLSS 神经渲染正在运行，在游戏自身的 DLSS 处理之前对输入颜色去噪（pre-SR）。"},
    {"DLSS Neural Rendering is live and replacing the game's DLSS output.", "DLSS 神经渲染正在运行，并替换游戏的 DLSS 输出。"},
    {"WARNING: Streamline hooks ON (EnableHooks=1). Contested patch site - if the game crashes at boot, set EnableHooks=2 (NGX-only still covers Streamline calls).", "警告：Streamline 接入已开启（EnableHooks=1），可能与其他组件争用接入位置。如果游戏启动时崩溃，请设为 EnableHooks=2；仅 NGX 模式仍覆盖 Streamline 调用。"},
    {"Scales both axes of the private DLAA + Neural Rendering work textures. The game/backbuffer stays native-sized. Applied once 400 ms after dragging stops.", "同时缩放内部 DLAA 与神经渲染工作纹理的两个方向。游戏画面和最终画面保持原生尺寸，停止拖动 400 毫秒后应用一次。"},
    {"Presets differ in how hard DLSS clamps history against the current frame. If motion warps around transparents (dust, smoke, flames), try E or F.", "这些预设控制 DLSS 根据当前帧限制历史画面的强度。如果尘土、烟雾、火焰等透明区域周围发生运动扭曲，可尝试 E 或 F。"},
    {"A flat sample is a diagnostic warning, not an automatic disable: inspect the shader's depth debug view and Generic Depth settings.", "深度样本没有变化只是诊断提示，不会自动关闭功能；请检查着色程序的深度诊断视图和 Generic Depth（通用深度）设置。"},
    {"Frames to hold a feature (re)build after a runtime (re)init -- the DLSS 5 add-on arms its NGX hooks asynchronously.", "组件初始化或重新初始化后，等待多少帧才创建或重建功能；DLSS 5 插件会异步准备 NGX 接入点。"},
    {"Re-creates the feature once after N delivered frames -- works around the classic DLSS 5 add-on latching STANDBY on its first create. Skipped automatically on v45+ (not shown as adjustable there).", "传送 N 帧后重建功能一次，避免经典 DLSS 5 插件首次创建时停留在待机状态。v45 及更新版本会自动跳过此步骤，也不显示可调整项。"},
    {"Active path: pre-SR - before the game's NGX DLSS evaluate; NR runs at the configured working resolution on the game's own depth/motion guides and the game's DLSS upscales the denoised color.  UI remains downstream.", "当前流程：pre-SR，在游戏的 NGX DLSS 处理之前执行。神经渲染以指定分辨率使用游戏自身的深度与运动数据，游戏的 DLSS 再放大去噪后的颜色；界面仍在后续阶段绘制。"},
    {"Active path: after - immediately following the game's NGX DLSS output; UI remains downstream.", "当前流程：后处理，紧接游戏的 NGX DLSS 输出执行；界面仍在后续阶段绘制。"},
    {"Codec: linear working space; commit re-encodes to the source format.", "颜色转换：在线性空间中处理，提交时重新编码为来源格式。"},
    {"Codec mode: anchored (%.1f-nit shoulder); pedestal capped at commit.", "颜色转换模式：锚定（%.1f 尼特高光区），提交时限制基底亮度。"},
    {"Codec mode: auto - calibrated sources use fixed units; relative HDR uses same-frame GPU autoscale.", "颜色转换模式：自动。已校准来源使用固定单位，相对 HDR 使用同帧 GPU 自动缩放。"},
    {"Codec mode: classic paper-white gain.", "颜色转换模式：经典基准白色增益。"},
    {"Bridge is off", "连接已关闭"}, {"RenoDX is not loaded", "尚未加载 RenoDX"},
    {"Unsupported RenoDX binary; this build drives RenoDX 6.5.3 and v4.7", "此 RenoDX 文件不受支持；当前连接支持 6.5.3 和 v4.7"},
    {"Unexpected ImGui interface; bridge refused", "菜单接口与已核验版本不符，已停止连接"},
    {"RenoDX code fingerprint mismatch", "RenoDX 代码特征与已核验版本不符"},
    {"UI dispatch changed; bridge refused", "菜单接口已发生变化，已停止连接"},
    {"RenoDX controls unavailable", "RenoDX 控件暂不可用"}
    ,{"It only recognises the v4.55-era build (alexs-toolkit.log: \"Generic structural layout rejected\").", "它只识别 v4.55 时期的版本（alexs-toolkit.log：\"Generic structural layout rejected\"）。"}
    ,{"Use the v4.55-era renodx-dlss5.addon64 for the cascade, or remove alexs-toolkit.addon64.", "如需连续处理，请使用 v4.55 时期的 renodx-dlss5.addon64，或移除 alexs-toolkit.addon64。"}
    ,{"The DLSS 5 add-on's neural pass is cs_5_1 and cannot compile against it (ReShade.log: \"error X3506: unrecognized compiler target 'cs_5_1'\").", "DLSS 5 插件的神经处理使用 cs_5_1，无法通过此编译器编译（ReShade.log：\"error X3506: unrecognized compiler target 'cs_5_1'\"）。"}
    ,{"NVIDIA Smooth Motion is active (NvPresent64.dll). It adds a proxy swapchain, so ReShade runs %d effect runtimes here; this add-on feeds the one rendering DLSS5_Feed (%p). If the image corrupts or flickers, disable it for this game's API only: Profile Inspector, \"Smooth Motion - Enabled APIs\" (1=DX12, 2=DX11, 4=Vulkan).", "NVIDIA Smooth Motion 已启用（NvPresent64.dll）。它会加入代理画面交换流程，因此 ReShade 在此运行 %d 个效果实例；本插件向渲染 DLSS5_Feed 的实例（%p）传送数据。如果画面损坏或闪烁，可在 Profile Inspector 的 \"Smooth Motion - Enabled APIs\" 中仅关闭此游戏所用接口（1=DX12、2=DX11、4=Vulkan）。"}
    ,{"Below 100% the whole image is rendered smaller and stretched back, so it looks blurry. For a sharp image, leave this at 100% and feed a DLSS 5 neural rendering mod that can lower the resolution of the neural pass alone, such as OptiScaler DLSS-NR (WorkingScale under [DlssNr] in OptiScaler.ini).", "低于 100% 时，整个画面会以较小尺寸渲染后再拉伸，因此会变模糊。要保持清晰，请设为 100%，并使用可单独降低神经处理分辨率的 DLSS 5 神经渲染组件，例如 OptiScaler DLSS-NR（OptiScaler.ini 的 [DlssNr] 下的 WorkingScale）。"}
    ,{"Replaces the bilinear stretch of the work-size output with AMD FSR 1 spatial upscaling and RCAS sharpening: much crisper than the stretch at 50-75%. A better filter for the cost knob above, not DLSS Quality: the result can never exceed the native frame. At 100% only the sharpening runs.", "使用 AMD FSR 1 空间放大与 RCAS 锐化，替代工作尺寸输出的双线性拉伸，在 50–75% 时明显更清晰。这是上方开销调整的更好滤镜，并非 DLSS Quality；结果不会超过原生画面。100% 时只执行锐化。"}
    ,{"Experimental. After the real evaluate, runs the same frame N more times with zero motion and no reset before the result goes home. Every neural pass keeps a history that takes a few frames to settle on a new framing, and each extra evaluate advances it one step without the scene moving -- so the image settles sooner after the camera stops. Costs (N+1)x the whole neural stack every frame. Meant for OptiScaler DLSS-NR; other consumers may ignore the zero motion.", "实验功能。正常处理后，在结果返回前以零运动、不重置的方式对同一帧额外处理 N 次。各次神经处理保留的历史通常需要几帧才能稳定；额外处理会在场景不动时继续推进，使镜头停止后更快稳定。每帧开销为整个神经处理流程的 (N+1) 倍。适用于 OptiScaler DLSS-NR，其他组件可能忽略零运动。"}
    ,{"Experimental. Where the game's frame did not change since the pixel last moved, the shown pixel keeps this much of what was shown last frame and takes the rest from the model; where the frame changed, the model's answer shows as is. 0 = off. 1 = a still region never moves until something in it really changes. 0.9 = the model's new opinion fades in over ~10 frames. One compute pass after the evaluate.", "实验功能。如果像素上次移动后，游戏画面未变化，则按此比例保留上一帧显示内容，其余来自模型；画面变化处直接显示模型结果。0 为关闭；1 表示静止区域保持不动，直到内容真正变化；0.9 表示新模型结果约经 10 帧逐渐融入。正常处理后额外执行一次计算。"}
    ,{"How much a pixel's input (3x3 box, relative to its brightness) may differ from its anchor and still count as still. Below it: held. At twice it: the model shows through fully. Raise it if a held region unlocks by itself (exposure drift, shimmer); lower it if slow animation lags behind.", "像素输入（相对于亮度的 3×3 区域）与锚定值允许相差多少仍算静止。低于此值时保持原画面，达到两倍时完全显示模型结果。如果保持区域自行解除（曝光漂移或微闪），可提高此值；如果缓慢动画滞后，可降低。"}
    ,{"Change the provider with DLSS5_Feed.fx's DLSS5_MV_PROVIDER preprocessor definition: 0 texMotionVectors (qUINT, dh_uber_motion), 1 Launchpad, 2 VORT, 3 LumeniteFX Kernel, 4 LumeniteFX QuantMotion.", "通过 DLSS5_Feed.fx 的 DLSS5_MV_PROVIDER 预处理定义选择来源：0 texMotionVectors（qUINT、dh_uber_motion），1 Launchpad，2 VORT，3 LumeniteFX Kernel，4 LumeniteFX QuantMotion。"}
    ,{"Extra scene-linear gain for PQ sources (classic and Auto over absolute units).  1 = the 203-nit BT.2408 reference; the pre-v6 default was 2.5375 and migrated configs keep it.", "PQ 来源的额外场景线性增益（经典模式，以及使用绝对单位的自动模式）。1 对应 BT.2408 的 203 尼特参考值；v6 之前默认为 2.5375，迁移配置会保留此值。"}
    ,{"PQ HDR bridge anchor: the nit level treated as diffuse white (BT.2408 reference is 203).  Ignored on the SDR path; the linear HDR path uses Paper-White Scale instead.", "PQ HDR 转换锚点：作为漫反射白色的亮度（BT.2408 参考值为 203 尼特）。SDR 流程忽略此项；线性 HDR 流程改用基准白色比例。"}
    ,{"Classic and Auto-over-linear codec gain (2.5375 = 203-nit diffuse white); PQ sources use Diffuse White and PQ Calibration instead.", "经典模式和线性来源自动模式的颜色转换增益（2.5375 对应 203 尼特漫反射白色）；PQ 来源改用漫反射白色与 PQ 校准。"}
    ,{"Bound of the chroma part of the neural transfer, in stops either side of the luma gain.  1.00 keeps the validated default; the luma gain itself stays bounded to +/-2 stops.", "神经渲染结果转换中色度的限制范围，以亮度增益两侧的曝光档数表示。1.00 保持已验证的默认值；亮度增益本身仍限制在 ±2 档。"}
    ,{"How the model's edit is carried back to HDR on the Display codec.  Bounded ratio applies the proxy-domain change as-is, which under-transfers brightness edits where the proxy curve bends.  Consistent also undoes the curve's gain change, damped where the curve is too flat to invert.  The model sees the same input either way.", "显示颜色转换模式中，将模型修改传回 HDR 的方式。“限制比例”直接应用代理画面的变化，在代理曲线弯曲处可能不足以传递亮度变化；“一致转换”还会抵消曲线的增益变化，并在曲线过平、难以反算处减弱处理。两种方式下模型输入相同。"}
    ,{"How the same-frame autoscale candidate becomes the applied divisor.  Stable uses a continuous estimate, settles at fixed rates per second (fast when brightening toward clipping, slow when relaxing) and holds still inside a small band, so neither a flickering scene statistic nor a settings edit can pump the image.  Slew is the v6.1.2 per-frame limit; Off applies the raw candidate (v6.1.0).  Calibrated/absolute sources ignore all.", "同帧自动缩放候选值成为实际除数的方式。“稳定”使用连续估计，以固定的每秒速度收敛（变亮接近截断时快，回落时慢），并在小范围内保持不动，避免场景统计波动或设置修改引起亮度起伏。“渐变限制”使用 v6.1.2 的每帧限制；“关闭”直接使用原始候选值（v6.1.0）。已校准的绝对来源忽略这些选项。"}
    ,{"Largest step the committed divisor may take in one frame.  0.020 is ~1.2 stops/s at 60 Hz: faster than engine eye adaptation, far slower than the frame-to-frame oscillation it damps.  Scene cuts, config changes and feature rebuilds snap instead of slewing, so raising this only affects tracking lag.  0 behaves as Off.", "实际除数每帧允许的最大变化。60 Hz 时，0.020 约为每秒 1.2 曝光档：比引擎眼睛适应快，远慢于它要抑制的逐帧振荡。场景切换、配置修改和功能重建会直接跳转，所以提高此值只影响跟随延迟。0 等同关闭。"}
    ,{"ON (default): every stacked pass keeps its own temporal history (reset only on scene cuts/contract changes). OFF: legacy diagnostic mode - passes 2+ are stateless (Reset every frame).  NVIDIA documents Reset-per-frame as a flicker/aliasing risk; only turn chained OFF to A/B a suspected ghosting compounding.", "开启（默认）：各次叠加处理保留各自的时间历史，只在场景切换或数据约定变化时重置。关闭：旧版诊断模式，第 2 次及之后的处理无状态、每帧重置。NVIDIA 文档指出每帧重置可能导致闪烁或锯齿；只有为对比验证疑似叠加拖影时才关闭。"}
    ,{"WARNING: Frame generation detected with NR stacking enabled. Each extra stack pass costs a full neural evaluate on the base frame and can push the game out of its frame-generation budget (MFG drops or hangs). Consider fewer passes or a lower NR resolution.", "警告：启用神经渲染多次处理时检测到帧生成。每次额外处理都需要对基础帧执行一次完整神经计算，可能超出帧生成预算（MFG 掉帧或卡住）。请考虑减少处理次数或降低神经渲染分辨率。"}
};

inline const char *lookup(const char *text) {
    if (!text) return text;
    for (const auto &word : words) if (strcmp(text, word.en) == 0) return word.zh;
    return text;
}
inline std::string rendered(const std::string &text);
// PushID and other ID-only arguments retain the original table. These two
// exact callbacks do not call GetID/GetID2/GetID3/GetID4. A translated ordinary
// label has a NEW but stable UI identity (### does not preserve its old hash).
// Existing ### identities stay unchanged. No configuration names or values
// are derived here; only UI labels change, so fold/focus state may reset once.
inline std::string widget(const char *label) {
    if (!label || !*label || strncmp(label, "##", 2) == 0) return label ? label : "";
    const char *end = strstr(label, "##");
    std::string visible(label, end ? end : label + strlen(label));
    const auto translated = rendered(visible);
    if (visible == translated) return label;
    const char *identity = strstr(label, "###");
    return translated + (identity ? identity : std::string("###") + label);
}
// Match the complete printf conversion spelling, in order. This also checks
// dynamic widths and lengths; translating a format can never change its ABI.
inline std::string signature(const char *format) {
    std::string out;
    for (const char *p = format; p && *p; ++p) if (*p == '%') {
        const char *start = p++;
        if (!*p) return "!invalid";
        if (*p == '%') { out += "%%;"; continue; }
        while (*p && strchr("-+ #0'.0123456789*hljztLI", *p)) ++p;
        if (!*p || !strchr("diuoxXfFeEgGaAcsp", *p)) return "!invalid";
        out.append(start, p + 1); out += ';';
    }
    return out;
}
inline const char *format(const char *original) {
    const char *translated = lookup(original);
    if (!translated || !original) return original;
    const auto expected = signature(original);
    return expected != "!invalid" && expected == signature(translated) ? translated : original;
}
// Some add-on helpers format locally, then call TextUnformatted. Translate
// their known literal parts, copying every already-rendered value verbatim.
// This never interprets the displayed text as a printf format.
inline std::vector<std::string> literal_parts(const char *fmt) {
    std::vector<std::string> parts; std::string literal;
    for (const char *p = fmt; *p; ++p) {
        if (*p != '%') { literal += *p; continue; }
        if (p[1] == '%') { literal += '%'; ++p; continue; }
        parts.push_back(literal); literal.clear(); ++p;
        while (*p && strchr("-+ #0'.0123456789*hljztLI", *p)) ++p;
        if (!*p) return {};
    }
    parts.push_back(literal); return parts;
}
inline std::string rendered_value(const std::string &value) {
    const char *exact = lookup(value.c_str()); if (value != exact) return exact;
    // Adjacent %s arguments can be a version/hash plus a known status suffix.
    // Only explicit internal suffixes are recognized; the preceding value is
    // kept verbatim unless it too is an exact known diagnostic.
    for (const auto &word : words) {
        if (strncmp(word.en, "; ", 2) && strncmp(word.en, " (", 2)) continue;
        const size_t n = strlen(word.en);
        if (n < value.size() && value.compare(value.size()-n, n, word.en) == 0)
            return rendered_value(value.substr(0, value.size()-n)) + word.zh;
    }
    return value;
}
inline std::string rendered(const std::string &text) {
    const char *exact = lookup(text.c_str()); if (text != exact) return exact;
    struct pattern { std::vector<std::string> source, dest; };
    static const std::vector<pattern> patterns = [] {
        std::vector<pattern> result;
        for (const auto &word : words) {
            const auto sig = signature(word.en);
            if (sig.empty() || sig == "!invalid" || sig != signature(word.zh)) continue;
            auto source = literal_parts(word.en), dest = literal_parts(word.zh);
            bool has_literal = false; for (const auto &part : source) if (!part.empty()) has_literal = true;
            if (source.size() >= 2 && source.size() == dest.size() && has_literal)
                result.push_back({std::move(source), std::move(dest)});
        }
        return result;
    }();
    for (const auto &item : patterns) {
        const auto &source = item.source, &dest = item.dest;
        if (text.compare(0, source[0].size(), source[0])) continue;
        size_t offset = source[0].size(); std::string result = dest[0]; bool matched = true;
        for (size_t i = 1; i < source.size(); ++i) {
            const auto end = source[i].empty() ? (i + 1 == source.size() ? text.size() : offset) : text.find(source[i], offset);
            if (end == std::string::npos) { matched = false; break; }
            const auto value = text.substr(offset, end - offset);
            result += rendered_value(value); result += dest[i]; offset = end + source[i].size();
        }
        if (matched && offset == text.size()) return result;
    }
    return text;
}
inline bool use_chinese(reshade::api::effect_runtime *runtime) {
    char value[64] = {}; size_t size = sizeof(value);
    if (!runtime || !reshade::get_config_value(runtime, "OVERLAY", "Language", value, &size)) return false;
    value[sizeof(value)-1] = 0;
    return _strnicmp(value, "zh", 2) == 0 && (value[2] == 0 || value[2] == '-' || value[2] == '_');
}
inline const imgui_function_table *original = nullptr;
inline imgui_function_table translated;
inline bool initialized = false;
inline HMODULE pinned_self = nullptr;

// The helpers do not format user text: translated strings are always arguments
// to a fixed %s. All other calls retain their original va_list and conversions.
#define NATIVE_TEXT_WRAPPER(Name) \
inline void emit_##Name(const char *fmt, ...) { va_list args; va_start(args, fmt); original->Name(fmt, args); va_end(args); } \
inline void wrap_##Name(const char *fmt, va_list args) { \
    if (fmt && strcmp(fmt, "%s") == 0) { va_list copy; va_copy(copy, args); const char *value = va_arg(copy, const char *); va_end(copy); const auto text = rendered(value ? value : ""); emit_##Name("%s", text.c_str()); } \
    else if (fmt && lookup(fmt) != fmt && signature(fmt) == "%s;") { va_list copy; va_copy(copy, args); const char *value = va_arg(copy, const char *); va_end(copy); emit_##Name(format(fmt), lookup(value)); } \
    else if (fmt && !strcmp(fmt, "DLSS5_MV_PROVIDER=%d (%s) -> %s (%s)")) { va_list copy; va_copy(copy, args); const int provider = va_arg(copy, int); const char *name = va_arg(copy, const char *); const char *shader = va_arg(copy, const char *); const char *status = va_arg(copy, const char *); va_end(copy); emit_##Name(format(fmt), provider, name, shader, lookup(status)); } \
    else original->Name(format(fmt), args); \
}
NATIVE_TEXT_WRAPPER(TextV)
NATIVE_TEXT_WRAPPER(TextDisabledV)
NATIVE_TEXT_WRAPPER(TextWrappedV)
NATIVE_TEXT_WRAPPER(BulletTextV)
NATIVE_TEXT_WRAPPER(SetTooltipV)
NATIVE_TEXT_WRAPPER(SetItemTooltipV)
#undef NATIVE_TEXT_WRAPPER
inline void emit_colored(const ImVec4 &color, const char *fmt, ...) { va_list args; va_start(args, fmt); original->TextColoredV(color, fmt, args); va_end(args); }
inline void wrap_colored(const ImVec4 &color, const char *fmt, va_list args) {
    if (fmt && !strcmp(fmt, "%s")) { va_list copy; va_copy(copy, args); const char *value = va_arg(copy, const char *); va_end(copy); const auto text = rendered(value ? value : ""); emit_colored(color, "%s", text.c_str()); }
    else if (fmt && lookup(fmt) != fmt && signature(fmt) == "%s;") {
        va_list copy; va_copy(copy, args); const char *value = va_arg(copy, const char *); va_end(copy); emit_colored(color, format(fmt), lookup(value));
    }
    else if (fmt && !strcmp(fmt, "DLSS5_MV_PROVIDER=%d (%s) -> %s (%s)")) {
        va_list copy; va_copy(copy, args); const int provider = va_arg(copy, int);
        const char *name = va_arg(copy, const char *); const char *shader = va_arg(copy, const char *); const char *status = va_arg(copy, const char *); va_end(copy);
        emit_colored(color, format(fmt), provider, name, shader, lookup(status));
    }
    else if (fmt && !strcmp(fmt, "RenoDX DLSS5 Generic %s | DLSSNR v310.8.0: %s")) {
        va_list copy; va_copy(copy, args); const char *version = va_arg(copy, const char *); const char *status = va_arg(copy, const char *); va_end(copy);
        emit_colored(color, format(fmt), version, lookup(status));
    } else original->TextColoredV(color, format(fmt), args);
}
inline void wrap_unformatted(const char *text, const char *end) {
    if (!text) { original->TextUnformatted(text, end); return; }
    const auto value = rendered(end ? std::string(text, end) : std::string(text));
    original->TextUnformatted(value.c_str(), nullptr);
}
inline void wrap_separator(const char *label) { original->SeparatorText(lookup(label)); }
inline bool wrap_checkbox(const char *label, bool *v) { const auto name = widget(label); return original->Checkbox(name.c_str(), v); }
inline bool wrap_button(const char *label, const ImVec2 &size) { const auto name = widget(label); return original->Button(name.c_str(), size); }
inline bool wrap_small_button(const char *label) { const auto name = widget(label); return original->SmallButton(name.c_str()); }
inline bool wrap_slider_float(const char *label, float *v, float lo, float hi, const char *fmt, ImGuiSliderFlags flags) { const auto name = widget(label); return original->SliderFloat(name.c_str(), v, lo, hi, fmt, flags); }
inline bool wrap_slider_int(const char *label, int *v, int lo, int hi, const char *fmt, ImGuiSliderFlags flags) { const auto name = widget(label); return original->SliderInt(name.c_str(), v, lo, hi, fmt, flags); }
inline bool wrap_input_int(const char *label, int *v, int step, int fast, ImGuiInputTextFlags flags) { const auto name = widget(label); return original->InputInt(name.c_str(), v, step, fast, flags); }
inline bool wrap_input_float(const char *label, float *v, float step, float fast, const char *fmt, ImGuiInputTextFlags flags) { const auto name = widget(label); return original->InputFloat(name.c_str(), v, step, fast, fmt, flags); }
inline bool wrap_drag_float(const char *label, float *v, float speed, float lo, float hi, const char *fmt, ImGuiSliderFlags flags) { const auto name = widget(label); return original->DragFloat(name.c_str(), v, speed, lo, hi, fmt, flags); }
inline bool wrap_drag_int(const char *label, int *v, float speed, int lo, int hi, const char *fmt, ImGuiSliderFlags flags) { const auto name = widget(label); return original->DragInt(name.c_str(), v, speed, lo, hi, fmt, flags); }
inline bool wrap_header(const char *label, ImGuiTreeNodeFlags flags) { const auto name = widget(label); return original->CollapsingHeader(name.c_str(), flags); }
inline bool wrap_header2(const char *label, bool *visible, ImGuiTreeNodeFlags flags) { const auto name = widget(label); return original->CollapsingHeader2(name.c_str(), visible, flags); }
inline bool wrap_tree(const char *label, ImGuiTreeNodeFlags flags) { const auto name = widget(label); return original->TreeNodeEx(name.c_str(), flags); }
inline bool wrap_tree_plain(const char *label) { const auto name = widget(label); return original->TreeNode(name.c_str()); }
inline bool wrap_selectable(const char *label, bool selected, ImGuiSelectableFlags flags, const ImVec2 &size) { const auto name = widget(label); return original->Selectable(name.c_str(), selected, flags, size); }
inline bool wrap_selectable2(const char *label, bool *selected, ImGuiSelectableFlags flags, const ImVec2 &size) { const auto name = widget(label); return original->Selectable2(name.c_str(), selected, flags, size); }
inline bool wrap_begin_combo(const char *label, const char *preview, ImGuiComboFlags flags) { const auto name = widget(label); return original->BeginCombo(name.c_str(), lookup(preview), flags); }
inline bool wrap_combo(const char *label, int *index, const char *const items[], int count, int height) {
    const auto name = widget(label);
    if (count < 0 || count > 256 || (!items && count)) return original->Combo(name.c_str(), index, items, count, height);
    std::vector<std::string> values; std::vector<const char *> pointers;
    values.reserve(count); pointers.reserve(count);
    for (int i = 0; i < count; ++i) values.emplace_back(items[i] ? widget(items[i]) : "");
    for (auto &value : values) pointers.push_back(value.c_str());
    return original->Combo(name.c_str(), index, pointers.data(), count, height);
}
inline bool wrap_combo2(const char *label, int *index, const char *items, int height) {
    const auto name = widget(label);
    if (!items) return original->Combo2(name.c_str(), index, items, height);
    std::string values;
    const char *p = items; size_t used = 0; unsigned count = 0;
    while (*p && count++ < 256 && used < 65536) {
        const size_t n = strnlen(p, 4097); if (n > 4096) return original->Combo2(name.c_str(), index, items, height);
        values += widget(p); values += '\0'; p += n + 1; used += n + 1;
    }
    if (*p) return original->Combo2(name.c_str(), index, items, height);
    values += '\0';
    return original->Combo2(name.c_str(), index, values.c_str(), height);
}
inline bool initialize() {
    const auto table = imgui_function_table_instance();
    if (initialized) return original == table;
    if (!table || !table->TextV || !table->Checkbox || !table->GetID) return false;
    // Foreign code can retain a function pointer during shutdown. Pin this
    // module before publishing any wrapper, so both table and code survive
    // until process exit even after all slots/events have been restored.
    if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_PIN | GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
        reinterpret_cast<LPCWSTR>(&translated), &pinned_self)) return false;
    original = table; translated = *table;
    translated.TextUnformatted = wrap_unformatted; translated.TextV = wrap_TextV;
    translated.TextColoredV = wrap_colored; translated.TextDisabledV = wrap_TextDisabledV;
    translated.TextWrappedV = wrap_TextWrappedV; translated.BulletTextV = wrap_BulletTextV;
    translated.SetTooltipV = wrap_SetTooltipV; translated.SetItemTooltipV = wrap_SetItemTooltipV;
    translated.SeparatorText = wrap_separator; translated.Checkbox = wrap_checkbox;
    translated.Button = wrap_button; translated.SmallButton = wrap_small_button;
    translated.SliderFloat = wrap_slider_float; translated.SliderInt = wrap_slider_int;
    translated.InputInt = wrap_input_int; translated.InputFloat = wrap_input_float;
    translated.DragFloat = wrap_drag_float; translated.DragInt = wrap_drag_int;
    translated.CollapsingHeader = wrap_header; translated.CollapsingHeader2 = wrap_header2;
    translated.TreeNodeEx = wrap_tree; translated.TreeNode = wrap_tree_plain;
    translated.Selectable = wrap_selectable; translated.Selectable2 = wrap_selectable2;
    translated.BeginCombo = wrap_begin_combo; translated.Combo = wrap_combo; translated.Combo2 = wrap_combo2;
    initialized = true; return true;
}

// Offline provenance for Feeder 1.17.0 (329728 bytes, SHA-256 below): the unique
// "mov ecx,19250; call rax; mov [rip+disp32],rax" starts at RVA 0x25cc2.
// The preceding GetProcAddress uses "ReShadeGetImGuiFunctionTable" at RVA
// 0x33380. 0x25cc2 + 14 + 0x29f40 = 0x4fc10, inside writable .data.
// RenoDX 6.5.3 has the same unique sequence at 0x65876: +14+0x69674 =
// 0xceef8. Its exact file/hash/code pin is shared with the existing scraper.
inline const unsigned char feeder_hash[] = {0x68,0x54,0xd0,0x12,0xea,0xc3,0x07,0x02,0x1c,0xd3,0x1c,0x97,0x8b,0xaf,0xd4,0x2f,0x1e,0x22,0xc5,0xb7,0xb2,0x92,0x2c,0x80,0xe0,0xa0,0x01,0x0d,0x42,0x8a,0x3f,0xd7};
inline const unsigned char feeder_init[] = {0xb9,0x32,0x4b,0x00,0x00,0xff,0xd0,0x48,0x89,0x05,0x40,0x9f,0x02,0x00};
struct target {
    const wchar_t *name; DWORD size; const unsigned char *hash;
    DWORD slot, init_at; const unsigned char *init; DWORD init_size;
    HMODULE checked = nullptr; bool accepted = false, owned = false;
};
inline target targets[] = {
    {L"dlss5-feed.addon64", 329728, feeder_hash, 0x4fc10, 0x25cc2, feeder_init, sizeof(feeder_init)},
    {L"renodx-dlss5.addon64", 878080, nr_probe::sha_653, 0xceef8, 0x65876, nr_probe::init_653, sizeof(nr_probe::init_653)}
};
inline std::mutex dispatch_mutex;
inline bool stopping = false;
inline void startup() { std::lock_guard<std::mutex> lock(dispatch_mutex); stopping = false; }
struct module_reference {
    HMODULE module = nullptr;
    explicit module_reference(const wchar_t *name) { GetModuleHandleExW(0, name, &module); }
    ~module_reference() { if (module) FreeLibrary(module); }
};
inline bool writable_slot(void *slot) {
    MEMORY_BASIC_INFORMATION info = {};
    if (!VirtualQuery(slot, &info, sizeof(info)) || info.State != MEM_COMMIT || (info.Protect & (PAGE_GUARD | PAGE_NOACCESS))) return false;
    const DWORD protection = info.Protect & 0xff;
    return (protection == PAGE_READWRITE || protection == PAGE_EXECUTE_READWRITE) &&
        reinterpret_cast<uintptr_t>(slot) + sizeof(void *) <= reinterpret_cast<uintptr_t>(info.BaseAddress) + info.RegionSize;
}
inline void restore(target &pin, HMODULE module) {
    if (pin.owned && module && module == pin.checked) {
        auto slot = reinterpret_cast<void *volatile *>(reinterpret_cast<unsigned char *>(module) + pin.slot);
        if (writable_slot(const_cast<void *>(reinterpret_cast<const volatile void *>(slot))))
            InterlockedCompareExchangePointer(slot, const_cast<imgui_function_table *>(original), &translated);
    }
    pin.owned = false;
}
inline void tick(reshade::api::effect_runtime *runtime) {
    std::lock_guard<std::mutex> lock(dispatch_mutex);
    if (stopping) return;
    const bool chinese = use_chinese(runtime);
    if (chinese && !initialize()) return;
    for (auto &pin : targets) {
        module_reference reference(pin.name); const HMODULE module = reference.module;
        if (!module) { pin.checked = nullptr; pin.accepted = pin.owned = false; continue; }
        if (module != pin.checked) {
            pin.checked = module; pin.owned = false;
            pin.accepted = nr_probe::hash_matches(module, pin.size, pin.hash);
        }
        if (!chinese) { restore(pin, module); continue; }
        if (!pin.accepted) continue;
        auto base = reinterpret_cast<unsigned char *>(module);
        if (memcmp(base + pin.init_at, pin.init, pin.init_size)) { restore(pin, module); pin.accepted = false; continue; }
        auto slot = reinterpret_cast<void *volatile *>(base + pin.slot);
        if (!writable_slot(base + pin.slot)) continue;
        const auto old = InterlockedCompareExchangePointer(slot, &translated, const_cast<imgui_function_table *>(original));
        // An arbitrary interface (including a capture table) is never replaced.
        pin.owned = old == original || old == &translated;
    }
}
inline const imgui_function_table *known_original(HMODULE module, const imgui_function_table *table) {
    std::lock_guard<std::mutex> lock(dispatch_mutex);
    if (table != &translated || !initialized) return nullptr;
    for (const auto &pin : targets) if (pin.checked == module && pin.accepted && pin.owned) return original;
    return nullptr;
}
inline void shutdown() {
    std::lock_guard<std::mutex> lock(dispatch_mutex);
    stopping = true;
    for (auto &pin : targets) {
        module_reference reference(pin.name); restore(pin, reference.module);
        // This DLL is pinned, so its cache outlives add-on unload/reload.
        // Re-verify a later file even when Windows reuses its module address.
        pin.checked = nullptr; pin.accepted = false;
    }
}
}
