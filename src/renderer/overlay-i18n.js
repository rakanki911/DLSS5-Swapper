'use strict';
// Simplified Chinese labels for the overlay gallery, its previews, and the
// live in-game panel. Product names and keyboard key names stay recognizable.
(() => {
  const zh = {
    'Overlay': '叠加层', 'BETA': '测试版',
    'Chat': '聊天', 'Community': '社区',
    'Choose your style. Preview it, then make it yours.': '选择一种风格，先预览，再按自己的喜好调整。',
    'Install overlay with DLSS': '安装 DLSS 时一并安装叠加层',
    'Developer files': '开发者文件', 'Hotkey': '快捷键',
    'Create theme': '创建主题', '＋ Add Overlay': '＋ 添加叠加层',
    'Interactive demo · no game changes': '交互式预览 · 不会修改游戏',
    'Saved.': '已保存。', 'Emerald': '翡翠', 'Azure': '蔚蓝', 'Amethyst': '紫水晶',
    '✓ Selected': '✓ 已选中', 'Select': '选择', '◉ Preview': '◉ 预览',
    'Delete this theme': '删除此主题',
    'Custom native overlay: browser preview unavailable. Only test trusted files.': '自定义原生叠加层暂不支持浏览器预览。请只测试可信文件。',
    'Install separately': '单独安装', 'Remove': '移除',
    'Existing installations': '已有安装', 'Remove overlay only': '仅移除叠加层',
    'Overlay service is not running. Restart DLSS 5 Swapper, then press the hotkey in game.': '叠加层服务未运行。请重启 DLSS 5 Swapper，再在游戏中按快捷键。',
    'Overlay service connected to a running game.': '叠加层已连接到正在运行的游戏。',
    'Overlay service ready, waiting for a game. Keep DLSS 5 Swapper open and press the hotkey in game.': '叠加层服务已就绪，正在等待游戏连接。请保持 DLSS 5 Swapper 运行，并在游戏中按快捷键。',
    'Done.': '已完成。', 'My theme': '我的主题',
    'Pick an accent colour. The panel\'s other shades are derived from it.': '选择一种强调色，面板中的其他色调会据此生成。',
    'Colour': '颜色', 'Name': '名称', 'Cancel': '取消', 'Save': '保存',
    'Give the theme a name.': '请为主题命名。',
    'Reserved / unsupported key. Try F9 or Ctrl + Shift + O.': '快捷键已被占用或不受支持。可尝试 F9 或 Ctrl + Shift + O。',
    'Space': '空格', 'PageUp': '向上翻页', 'PageDown': '向下翻页',
    'End': '结束', 'Left': '左', 'Right': '右', 'Up': '上', 'Down': '下',
    'Insert': '插入', 'Delete': '删除',

    'DLSS 5 SWAPPER CONTROLS': 'DLSS 5 Swapper 控制项', 'PREVIEW': '预览',
    'DLSS ON': 'DLSS 已开启', 'Preview only': '仅供预览',
    'ON-SCREEN STATUS': '游戏内状态提示',
    'Shows DLSS 5 On/Off over the game': '在游戏画面中显示 DLSS 5 开启/关闭状态',
    'GLOBAL CONTROLS': '全局控制', 'Structure Intensity': '结构强度',
    'Tone Intensity': '色调强度', 'MODEL AUTOMASK': '模型自动遮罩',
    'SDK required': '需要 SDK', 'DEVELOPER MASKING': '开发者遮罩',
    'Demo groups': '示例分组', 'Pitcher': '水壶', 'Grapes': '葡萄', 'Bottles': '瓶子',
    'MODELS': '模型', 'Preview selection': '预览选项', 'Model': '模型',
    'Default': '默认', 'Natural': '自然', 'Cinematic': '电影感',
    'RenoDX live': 'RenoDX 实时控制', 'Waiting for RenoDX': '等待 RenoDX',
    'RenoDX character mask': 'RenoDX 角色遮罩', 'CHARACTER MASK': '角色遮罩',
    'Character/Skin Structure': '角色/皮肤结构强度',
    'MORE RENODX CONTROLS': '更多 RenoDX 控制项',
    'Restart DLSS 5 Swapper and connect the updated overlay to load RenoDX controls.': '请重启 DLSS 5 Swapper，并连接更新后的叠加层以加载 RenoDX 控制项。',
    'NR STYLE': '神经渲染风格', 'FEEDER CONTROLS': 'Feeder 控制项',
    'NR Style': '神经渲染风格', 'Depth Convention': '深度方向',
    'Show RenoDX extras': '显示 RenoDX 扩展设置', 'Show Feeder controls': '显示 Feeder 设置',
    'Overall Intensity': '总体强度', 'Global Tone Intensity': '全局色调强度',
    'Enable DLSS Neural Rendering': '启用 DLSS 神经渲染',
    'Automatic / Character Mask': '自动 / 角色遮罩',
    'Local Tone Intensity': '局部色调强度',
    'Diffuse White (nits)': '漫反射白场亮度（尼特）',
    'Motion Scale X Multiplier': 'X 轴运动缩放倍数',
    'Motion Scale Y Multiplier': 'Y 轴运动缩放倍数',
    'NR UI Correction': '神经渲染界面校正',
    'Enable Upscaling (WIP)': '启用超分辨率（开发中）',
    'NR Preset': '神经渲染预设', 'Preset #1': '预设 1',
    'Preset #2': '预设 2', 'Preset #3': '预设 3',
    'Use game NGX flag': '使用游戏的 NGX 标记',
    'Force normal depth': '强制使用正向深度',
    'Force inverted depth': '强制使用反向深度',
    'Waiting for game connection': '等待游戏连接',
    'RenoDX controls unavailable.': 'RenoDX 控制项不可用。',
    'Unavailable': '不可用',
    'Interactive design preview only. Changes here do not affect a game. The installed overlay connects automatically to the verified RenoDX build.': '仅供界面预览；在此处更改不会影响游戏。安装后的叠加层会自动连接到已验证的 RenoDX 版本。',
    'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.': '界面参考 NVIDIA 设计。遮罩、模型和 DLSS 滑杆尚未连接到 SDK。',
    'Live RenoDX settings. A/B/C select NR Style, not AI models. Scroll More Controls; click a number to type. Home keeps the original tools available.': 'RenoDX 实时设置。A/B/C 选择的是神经渲染风格，不是 AI 模型。向下滚动查看更多设置；点击数值可直接输入。按 Home 仍可打开原有工具。',
    'Waiting for the verified RenoDX build. Connection is automatic; a build this overlay does not know is refused. Original tools remain available.': '正在等待已验证的 RenoDX 版本。叠加层会自动连接；无法识别的版本将被拒绝。原有工具仍可使用。',
    'Live tools': '实时工具', 'DLSS controls': 'DLSS 控制项',
    'Preview: RenoDX': '预览：RenoDX', 'Preview: Feeder + RenoDX': '预览：Feeder + RenoDX',
    'DLSS 5 SWAPPER · INJECTED TOOLS': 'DLSS 5 Swapper · 注入式工具',
    'LIVE RESHADE': 'ReShade 实时模式', 'DISCONNECTED': '未连接', 'CONNECTED': '已连接',
    'NOT CONNECTED': '未连接',
    'Design preview; no game connection.': '界面预览；尚未连接游戏。',
    'RenoDX controls use its original callback. FX controls below are separate. Experimental adapter; original tool windows remain available.': 'RenoDX 控制项使用其原有接口。下方 FX 控制项彼此独立。此连接方式仍在试验中，原有工具窗口仍可使用。',
    'Waiting for compatible RenoDX. FX controls do not control DLSS.': '正在等待兼容的 RenoDX。FX 控制项不会控制 DLSS。',
    'No separate .fx shader controls found. RenoDX controls above do not require .fx shaders.': '未发现单独的 .fx 着色器控制项。上方 RenoDX 控制项无需 .fx 着色器。',
    'F8: show/hide · Drag header: move · Esc: close · Home: original tools': 'F8：显示/隐藏 · 拖动标题栏：移动 · Esc：关闭 · Home：打开原有工具',
    'ReShade shader effects': 'ReShade 着色器效果',
    'Auto': '自动', 'Force SDR': '强制 SDR', 'Force HDR': '强制 HDR',
    'Normal': '正向', 'Inverted': '反向', 'Bilinear': '双线性',
    'FSR 1': 'FSR 1', 'DLSS SR (experimental)': 'DLSS 超分辨率（实验性）',
    'Off': '关闭', 'On': '开启', 'HDR contract': 'HDR 模式',
    'Depth convention': '深度方向', 'Work upscale': '工作分辨率放大方式',
    'HDR10 bridge': 'HDR10 转换桥接',
    'Feeder enabled (original panel)': '已启用 Feeder（原面板）',
    'Work resolution (%)': '工作分辨率（%）', 'Work sharpness': '工作画面锐度',
    'Motion scale X': 'X 轴运动缩放', 'Motion scale Y': 'Y 轴运动缩放',
    'HDR paper white (nits)': 'HDR 纸白亮度（尼特）',
    'Output stabiliser hold': '输出稳定保持',
    'Stabiliser change tolerance': '稳定器变化容差',
    'value': '数值', 'Model A': '模型 A', 'Model B': '模型 B', 'Model C': '模型 C',
    'On-screen status card': '游戏内状态提示', 'Overlay hotkey': '叠加层快捷键',
    'Click the field, then press your shortcut. Ctrl, Alt and Shift are supported. Home / Escape stay reserved for ReShade.': '点击下方按键框，再按下要设置的快捷键。支持 Ctrl、Alt 和 Shift。Home 和 Esc 保留给 ReShade 使用。',
    'Design preview only. Feeder cfg controls; work resolution, filter and sharpness require DX11.': '仅供界面预览。Feeder 配置项；工作分辨率、滤镜和锐度需要 DX11。',
    'Working': '正常运行', 'Works with issues': '可以运行，但有问题', 'Not working': '无法运行',
    'Drag header: move': '拖动标题栏：移动', 'show/hide': '显示/隐藏', 'close': '关闭',
    'original tools': '原有工具',
    'Bridge is off': '连接功能已关闭',
    'RenoDX is not loaded': 'RenoDX 尚未加载',
    'Unsupported RenoDX binary; this build drives RenoDX 6.5.3 and v4.7': '不支持此 RenoDX 版本；当前支持 6.5.3 和 4.7 版。',
    'Unexpected ImGui interface; bridge refused': '检测到不兼容的界面接口，已停止连接。',
    'RenoDX code fingerprint mismatch': 'RenoDX 程序校验不一致',
    'UI dispatch changed; bridge refused': '界面接口已发生变化，已停止连接。',
    'RenoDX controls unavailable': 'RenoDX 控制项不可用',
    'Feeder is not loaded': 'Feeder 尚未加载',
    'Unsupported Feeder binary (this build drives x64 v1.17.0)': '不支持此 Feeder 版本；当前支持 64 位的 1.17.0 版。',
    'Feeder config unavailable; let Feeder initialize': '暂时无法读取 Feeder 配置，请等待 Feeder 完成初始化。',
    'Feeder cfg reloads every 60 delivered frames. Work resolution/filter/sharpness and the HDR10 bridge: DX11 only. NR is separate.': 'Feeder 每输出 60 帧重新加载一次配置。工作分辨率、滤镜、锐度和 HDR10 转换仅支持 DirectX 11。神经渲染设置独立控制。',
    'Enable Feeder and select an active mode in its original page. Disabled/inert Feeder does not reload cfg.': '请在 Feeder 原有页面启用 Feeder 并选择有效模式。关闭或空闲时，Feeder 不会重新加载配置。',
    'Feeder cfg changed or write failed; retry': 'Feeder 配置已发生变化或写入失败，请重试。'
    , 'Invalid overlay settings. Home and Escape are reserved; Windows-key shortcuts are not supported.': '叠加层设置无效。Home 和 Esc 保留给原有工具使用；不支持包含 Windows 键的快捷键。'
    , 'Invalid custom overlay theme. Pick a colour and give it a name.': '自定义主题无效，请选择颜色并填写名称。'
    , 'Create a custom theme before selecting it.': '请先创建自定义主题，再进行选择。'
    , 'Invalid overlay preference': '叠加层偏好设置无效'
    , 'Invalid Windows PE binary.': 'Windows 程序文件无效。'
    , 'Expected a regular Windows binary.': '请选择常规 Windows 程序文件。'
    , 'ReShade add-ons must not exceed 64 MB.': 'ReShade 插件大小不能超过 64 MB。'
    , 'Only x64 and x86 Windows binaries are supported.': '仅支持 64 位和 32 位 Windows 程序。'
    , 'Choose a .addon64 or .addon32 DLL with matching architecture.': '请选择位数匹配的 .addon64 或 .addon32 插件。'
    , 'Choose the game executable, not a DLL.': '请选择游戏主程序文件，而不是 DLL 文件。'
    , 'Linked library directories are not allowed.': '插件库目录不能使用链接目录。'
    , 'Invalid overlay ID.': '叠加层标识无效。'
    , 'Invalid overlay record.': '叠加层记录无效。'
    , 'Overlay changed since import. Import it again.': '导入后的叠加层文件已被修改，请重新导入。'
    , 'Invalid installation record.': '安装记录无效。'
    , 'Stored overlay checksum mismatch.': '保存的叠加层文件校验不一致。'
    , 'Remove this overlay from its test game first.': '请先从测试游戏中移除此叠加层。'
    , 'Build the overlay add-on first.': '请先构建叠加层插件。'
    , 'Expected a regular Windows executable.': '请选择常规 Windows 主程序文件。'
    , 'Invalid executable architecture.': '主程序位数无效。'
    , 'Overlay and executable architectures do not match.': '叠加层与主程序的位数不匹配。'
    , 'The main app and toolchain directories cannot be overlay targets.': '不能将本程序或开发工具目录作为叠加层安装目标。'
    , 'Remove the previous test overlay before installing a new build.': '安装新版本前，请先移除旧的测试叠加层。'
    , 'Installed overlay was modified. Nothing was overwritten.': '已安装的叠加层文件被修改，本次未覆盖任何文件。'
    , 'Installation directory changed. Nothing was removed.': '安装目录已发生变化，本次未删除任何文件。'
    , 'Overlay was modified. Nothing was removed.': '叠加层文件被修改，本次未删除任何文件。'
    , 'The built-in overlay cannot be deleted.': '无法删除内置叠加层。'
    , 'Build the experimental add-on first (see Developer files).': '请先构建实验性插件，详见“开发者文件”。'
    , 'The in-game overlay currently supports 64-bit DX11/DX12 only.': '游戏内叠加层目前仅支持 64 位 DirectX 11 / DirectX 12。'
    , 'Remove the previous test overlay from the Overlay page before installing the updated build.': '安装更新版本前，请先在“叠加层”页面移除旧的测试叠加层。'
    , 'An untracked or modified overlay already exists.': '已存在未经本程序管理或被修改的叠加层。'
    , 'Overlay escaped the selected game.': '叠加层路径超出了所选游戏目录。'
  };

  window.overlayText = (english, arabic) => {
    const language = document.documentElement.lang;
    if (language === 'zh') return Object.prototype.hasOwnProperty.call(zh, english) ? zh[english] : english;
    if (language === 'ar') return arabic || english;
    return english;
  };
  window.localizeOverlayText = root => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const source = node.textContent, trimmed = source.trim();
      if (!trimmed) continue;
      const translated = window.overlayText(trimmed);
      if (translated !== trimmed) node.textContent = source.replace(trimmed, translated);
    }
  };
})();
