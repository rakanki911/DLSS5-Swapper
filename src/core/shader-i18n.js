'use strict';

// Only user-facing string literals are changed; missing display labels are added
// for two known techniques. Shader identifiers, controls, numbers, algorithms,
// comments and include paths stay intact.
// The catalog covers the bundled DLSS5_Feed, VORT and Lumenite shader families.
const zh = Object.freeze({
  "DLSS5_Feed needs D3D10 or newer, and ReShade has loaded its DirectX 9 backend. For a D3D9 game the dgVoodoo2 wrapper must be in effect first (check DisableAndPassThru=false in dgVoodoo.conf); see the README's 'Install for a DirectX 9 game' section. A 64-bit D3D9 game does not need this add-on at all -- renodx-dlss handles those on its own.": "DLSS5_Feed 需要 D3D10 或更新版本，但 ReShade 已加载 DirectX 9 后端。对于 D3D9 游戏，必须先启用 dgVoodoo2 转换器（检查 dgVoodoo.conf 中的 DisableAndPassThru=false）；请参阅 README 中的“为 DirectX 9 游戏安装”章节。64 位 D3D9 游戏无需此插件，renodx-dlss 会自行处理。",
  "DLSS5_Feed does nothing here: ReShade is running on DirectX 9, and the add-on only attaches to\n": "DLSS5_Feed 在这里不会生效：ReShade 正在使用 DirectX 9，而插件仅支持\n",
  "D3D10/11/12, OpenGL and Vulkan. For a 32-bit D3D9 game, put the dgVoodoo2 wrapper in front first\n": "D3D10/11/12、OpenGL 和 Vulkan。对于 32 位 D3D9 游戏，请先安装并启用 dgVoodoo2 转换器\n",
  "(DisableAndPassThru=false in dgVoodoo.conf) -- see the README's 'Install for a DirectX 9 game'.\n": "（在 dgVoodoo.conf 中设置 DisableAndPassThru=false），详见 README 的“为 DirectX 9 游戏安装”章节。\n",
  "A 64-bit D3D9 game does not need this add-on at all: renodx-dlss handles those on its own.": "64 位 D3D9 游戏无需此插件：renodx-dlss 会自行处理。",
  "Not available on DirectX 9 -- see the text in this effect's settings.": "DirectX 9 下不可用，请查看此效果设置中的说明文字。",
  "LumeniteFX Kernel (Kernel::tFlow, 1/8 res)": "LumeniteFX Kernel（Kernel::tFlow，1/8 分辨率）",
  "LumeniteFX QuantMotion (QuantMotion::tFlow, 1/8 res)": "LumeniteFX QuantMotion（QuantMotion::tFlow，1/8 分辨率）",
  "Motion vector provider: ": "运动矢量来源：",
  "Change it with the DLSS5_MV_PROVIDER preprocessor definition:\n": "通过 DLSS5_MV_PROVIDER 预处理定义更改来源：\n",
  "Enable that provider's technique ABOVE DLSS 5 Feed.": "请启用该来源的效果，并将它排在 DLSS 5 Feed 上方。",
  "Bilinear": "双线性",
  "Point (nearest)": "点采样（最近邻）",
  "Low-res provider filter": "低分辨率来源的过滤方式",
  "How the provider's 1/8-resolution flow is brought up to full resolution.\n": "将来源中 1/8 分辨率的光流放大到完整分辨率时使用的方式。\n",
  "Bilinear smooths across flow cells; point keeps each 8x8 cell's vector as-is.": "双线性过滤会平滑光流网格之间的过渡；点采样会保留每个 8×8 网格的原始矢量。",
  "Geometry vectors (camera model + depth) -- EXPERIMENTAL": "几何矢量（相机模型与深度）——实验功能",
  "Use geometry vectors (experimental, off by default)": "使用几何矢量（实验功能，默认关闭）",
  "Fit the camera motion from the provider's flow + depth each frame and derive every static\n": "每帧根据来源的光流与深度拟合相机运动，并据此计算每个静态\n",
  "pixel's vector from it. The provider is then only consulted for moving objects.\n": "像素的矢量。此后仅在处理移动物体时使用来源的光流。\n",
  "EXPERIMENTAL: the per-frame fit is still noisy, and anything not part of the 3D world\n": "实验功能：逐帧拟合仍有噪声，不属于三维场景的内容\n",
  "(the HUD) gets camera vectors it should not have -- expect jitter there.\n": "（例如游戏界面）也会获得不应有的相机矢量，可能发生抖动。\n",
  "Off = the per-pixel validation below is applied to the provider's flow directly.": "关闭时：将下方的逐像素验证直接应用于来源的光流。",
  "Geometry vectors (camera model + depth)": "几何矢量（相机模型与深度）",
  "Parallax depth scale": "视差深度比例",
  "The model's inverse-depth term is s / (depth + s) with linear depth in 0..1. Smaller = more\n": "模型的逆深度项为 s / (depth + s)，线性深度范围为 0..1。数值越小，\n",
  "parallax resolution near the camera. Usually fine as is.": "相机附近的视差分辨率越高。通常保持原值即可。",
  "Fit: outlier rejection (px)": "拟合：异常值排除阈值（像素）",
  "Second fitting pass ignores samples whose flow is further than this from the first pass's\n": "第二次拟合会忽略光流与第一次预测的距离超过此阈值的样本，\n",
  "prediction -- moving objects, flames, the first-person weapon.": "例如移动物体、火焰和第一人称武器。",
  "Agreement (px)": "一致性阈值（像素）",
  "If the provider's flow is within this many pixels (+10% of the vector) of the model, the\n": "若来源的光流与模型相差不超过此像素数（加上矢量长度的 10%），\n",
  "model's vector is used as-is. Beyond it, the structure test decides moving object vs junk.": "就直接使用模型矢量。超出时，由结构检验判断它是移动物体还是无效光流。",
  "Moving-object margin": "移动物体判定余量",
  "For the provider's flow to override the model on a disagreeing pixel, its reprojection must\n": "当某个像素的光流与模型不一致时，来源的重投影必须比模型\n",
  "explain the pixel's structure at least this much (relative) better than the model's does.\n": "更好地解释像素结构，且相对改善幅度至少达到此值，才能覆盖模型。\n",
  "Higher = more conservative (fewer things count as moving objects).": "数值越高，判定越保守（被视为移动物体的内容越少）。",
  "Mask strength on rejected flow": "被拒绝光流的遮罩强度",
  "Where the provider disagreed with the model but did not win the structure test (fire, smoke,\n": "当来源与模型不一致且未通过结构检验时（火焰、烟雾、\n",
  "flicker), the geometric vector is used; this is how strongly DLSS is additionally asked to\n": "闪烁），使用几何矢量；此设置决定额外要求 DLSS\n",
  "favour the current frame there. 0 = pure history (smoothest), 1 = mostly current frame.\n\n": "偏向当前帧的程度。0 = 完全使用历史帧（最平滑），1 = 主要使用当前帧。\n\n",
  "Also used by the static test's first frame when hysteresis holds its vector back.": "静态检验启用迟滞时，也会用于第一帧暂不清零矢量的像素。",
  "Validation (flicker / flames / disocclusion)": "验证（闪烁／火焰／新露出的区域）",
  "Validate motion vectors against the previous frame": "对照上一帧验证运动矢量",
  "Optical-flow providers answer a lighting change (flicker, flames) with a vector that\n": "光流来源可能把光照变化（闪烁、火焰）判断为运动，并生成指向\n",
  "points at whatever happened to match. Reprojecting and checking catches those:\n": "碰巧相似位置的矢量。重投影后进行检查可以发现这些情况：\n",
  "the vector is zeroed and DLSS is told to trust the current frame there (DLSS5_Mask).": "将矢量清零，并通过 DLSS5_Mask 告诉 DLSS 在该处信任当前帧。",
  "Static-hypothesis test (zeroes the vector, keeps history)": "静态假设检验（清零矢量，保留历史帧）",
  "For each pixel, asks which explains it better: 'did not move' or the provider's vector.\n": "逐个像素比较：“没有移动”和来源矢量，哪一种解释更合理。\n",
  "Both are scored on illumination-normalised 3x3 structure (local mean removed), so a\n": "两者均依据消除光照影响的 3×3 局部结构评分（去除局部平均值），因此\n",
  "flickering light does not count as motion. When 'did not move' wins, the vector is zeroed\n": "闪烁的光照不会被视为运动。“没有移动”胜出时，将矢量清零，\n",
  "and the pixel is NOT masked -- a static wall wants its full history, which is what smooths\n": "但不给像素添加遮罩；静止墙面需要完整的历史帧，才能平滑\n",
  "the flicker. This is the test for the flickering-wall case.": "闪烁。此检验用于处理墙面闪烁的情况。",
  "Static test: require two frames in a row": "静态检验：要求连续两帧通过",
  "The static test has no memory: on a low-contrast surface under a slow pan it can win on\n": "静态检验本身不记忆历史；在低对比度表面上缓慢移动相机时，它可能\n",
  "one frame and lose on the next, so the vector alternates between the provider's and zero\n": "在一帧胜出、下一帧失败，使矢量在来源值与零之间来回切换，\n",
  "and DLSS alternately reprojects and does not -- a flicker/judder that comes and goes.\n": "DLSS 也随之交替进行重投影，造成时有时无的闪烁或抖动。\n",
  "With this on, the vector is only zeroed where the test won on this frame AND the last;\n": "开启后，仅在当前帧和上一帧都通过检验时才将矢量清零；\n",
  "on the first frame the provider's vector is kept and the pixel is masked instead, so\n": "第一帧会保留来源矢量，并给像素添加遮罩，\n",
  "DLSS leans on the current frame rather than reprojecting from nowhere.\n": "让 DLSS 偏向当前帧，避免从错误的位置重投影。\n",
  "Turn it off to compare against the old (per-frame) behaviour.": "关闭后可与旧的逐帧处理方式进行比较。",
  "Static bias": "静态判定偏向",
  "How much worse (relative) the static explanation may score than the vector's and still win.\n": "静态解释的评分允许比矢量解释差多少（相对值），仍能胜出。\n",
  "0 = the vector must strictly beat 'did not move'. Higher favours zero vectors.": "0 = 矢量解释必须严格优于“没有移动”。数值越高，越偏向零矢量。",
  "Static test: minimum patch contrast": "静态检验：局部最低对比度",
  "Below this 3x3 contrast (mean absolute deviation of luma) a patch has no structure to judge\n": "当 3×3 区域的对比度（亮度的平均绝对偏差）低于此值时，没有足够的结构\n",
  "motion by, and the test abstains -- the provider's vector stands. Raise it if flat surfaces\n": "判断运动，因此不进行检验，保留来源矢量。若平坦表面在移动时\n",
  "trail while moving (yellow on plain motion in the debug view); lower it if the\n": "拖影（调试视图中普通运动显示为黄色），请提高此值；若无法\n",
  "flickering wall stops being caught.": "识别闪烁的墙面，请降低此值。",
  "Luma test (mask only)": "亮度检验（仅设置遮罩）",
  "The reprojected previous luma must fall inside the current 3x3 neighbourhood's luma range.\n": "上一帧重投影后的亮度必须处于当前 3×3 邻域的亮度范围内。\n",
  "A failure only raises the mask (DLSS leans on the current frame); it never zeroes the vector,\n": "检验失败仅提高遮罩强度（让 DLSS 偏向当前帧），不会将矢量清零，\n",
  "because a lighting change does not prove the surface did not move. Off by default: on a\n": "因为光照变化不能证明表面没有移动。默认关闭：在闪烁表面上，\n",
  "flickering surface it asks DLSS to drop exactly the history that would smooth the flicker.": "它会让 DLSS 丢弃原本可以平滑闪烁的历史帧。",
  "Luma tolerance": "亮度容差",
  "How far outside the current 3x3 neighbourhood's luma range the reprojected previous luma\n": "允许上一帧重投影后的亮度超出当前 3×3 邻域亮度范围\n",
  "may fall (relative to that range's maximum). Lower = stricter.": "的程度（相对于该范围的最大值）。数值越低，要求越严格。",
  "Depth test (zeroes the vector)": "深度检验（清零矢量）",
  "The reprojected previous linear depth must match the current one: a mismatch means the vector\n": "上一帧重投影后的线性深度必须匹配当前深度；不匹配说明矢量\n",
  "points at a different surface (disocclusion), so it is zeroed and masked. Sky is exempt.": "指向了另一表面（新露出的区域），因此清零矢量并设置遮罩。天空不参与此检验。",
  "Depth tolerance": "深度容差",
  "Allowed relative difference between the reprojected previous linear depth and the current one.": "允许上一帧重投影后的线性深度与当前深度之间的相对差异。",
  "Consistency test (zeroes the vector)": "一致性检验（清零矢量）",
  "This frame's vector must resemble the previous frame's vector at the spot it points to.\n": "当前帧矢量必须与它所指向位置的上一帧矢量相近。\n",
  "Real motion is smooth frame to frame; optical flow on fire, smoke or a flickering wall is not.\n": "真实运动在相邻帧之间较为平滑；火焰、烟雾或闪烁墙面的光流则不是。\n",
  "A failure zeroes the vector and masks the pixel.": "检验失败时，将矢量清零并给像素设置遮罩。",
  "Vector consistency (px)": "矢量一致性（像素）",
  "Allowed change, in pixels, between this frame's vector and the previous frame's vector at\n": "允许当前帧矢量与重投影位置的上一帧矢量相差\n",
  "the reprojected spot, plus 50% of the vector length. Raise it if plain camera motion\n": "的像素数，另加矢量长度的 50%。若普通相机运动在\n",
  "shows blue in the 'Validation tests' debug view.": "“验证检验”调试视图中显示为蓝色，请提高此值。",
  "Bias-current-colour mask strength": "偏向当前颜色的遮罩强度",
  "How strongly a distrusted pixel asks DLSS to favour the current frame (DLSS5_Mask).\n": "不可信像素要求 DLSS 偏向当前帧的程度（DLSS5_Mask）。\n",
  "1 = fully; 0 = only zero the vector, do not mask.": "1 = 完全偏向；0 = 仅清零矢量，不设置遮罩。",
  "Motion vector sign (x, y)": "运动矢量方向符号（x、y）",
  "Flip a component if the DLAA output doubles/smears in that direction while moving.\n": "若移动时 DLAA 输出在某个方向出现重影或拖影，可翻转对应分量的符号。\n",
  "Default (1, 1) matches the convention every supported provider uses (prev_uv = uv + mv).": "默认值 (1, 1) 符合所有受支持来源的约定（prev_uv = uv + mv）。",
  "Motion vector scale": "运动矢量比例",
  "1.0 = the provider's estimate as-is. Diagnostic only.": "1.0 = 保持来源的原始估计值。仅用于诊断。",
  "Motion vectors (colour = direction, brightness = speed)": "运动矢量（颜色表示方向，亮度表示速度）",
  "Raw depth": "原始深度",
  "Provider confidence (LumeniteFX only; white = confident)": "来源置信度（仅 LumeniteFX；白色表示可信）",
  "Validation mask (white = vector distrusted, DLSS uses current frame)": "验证遮罩（白色表示矢量不可信，DLSS 使用当前帧）",
  "Validation mask over the image": "将验证遮罩叠加到画面上",
  "Validation tests over the image (red = luma, green = depth, blue = consistency, yellow = vector zeroed, orange = static held back)": "将验证检验叠加到画面上（红：亮度，绿：深度，蓝：一致性，黄：矢量已清零，橙：暂不按静态处理）",
  "Geometry model vectors (colour = direction, brightness = speed)": "几何模型矢量（颜色表示方向，亮度表示速度）",
  "Geometry decision over the image (green = model, red = provider won as moving object, blue = provider rejected)": "将几何判定叠加到画面上（绿：模型，红：来源判定为移动物体，蓝：来源被拒绝）",
  "Geometry fit quality (grey = inlier share; top strip = fit error, black 0 px .. white 8 px)": "几何拟合质量（灰度：内点比例；顶部条带：拟合误差，黑色 0 像素至白色 8 像素）",
  "Debug view (DLSS5_Feed_Debug technique)": "调试视图（DLSS5_Feed_Debug 效果）",
  "DLSS 5 Feed (place below your motion-vector provider)": "DLSS 5 Feed（请排在运动矢量来源下方）",
  "Prepares motion vectors + depth (+ a trust mask) for the DLSS 5 Feed add-on.\n\n": "为 DLSS 5 Feed 插件准备运动矢量、深度和可信度遮罩。\n\n",
  "Provider: ": "来源：",
  "Change it with the DLSS5_MV_PROVIDER preprocessor definition (0 texMotionVectors,\n": "通过 DLSS5_MV_PROVIDER 预处理定义更改来源（0 texMotionVectors，\n",
  "1 Launchpad, 2 VORT, 3 LumeniteFX Kernel, 4 LumeniteFX QuantMotion) and enable\n": "1 Launchpad，2 VORT，3 LumeniteFX Kernel，4 LumeniteFX QuantMotion），并启用\n",
  "that provider's technique ABOVE this one.": "该来源的效果，将它排在此效果上方。",
  "DLSS 5 Feed - debug view": "DLSS 5 Feed - 调试视图",
  "Shows the motion vectors / depth / mask the add-on will send to DLSS. Enable only for checking.": "显示插件将发送给 DLSS 的运动矢量、深度和遮罩。仅在检查时开启。",
  "ReShade 3.0+ is required to use this header file": "使用此头文件需要 ReShade 3.0 或更新版本",
  "! HELP GUIDE !": "! 使用指南 !",
  "Motion Blur": "运动模糊",
  "Max Samples": "最大采样数",
  "Tradeoff between performance and quality.": "在性能和画质之间取舍。",
  "Warning:\nRead the tooltips if you want to change the below settings.": "注意：\n更改下方设置前，请阅读各项提示。",
  "Blur Multiplier": "模糊倍数",
  "By default the blur covers frame gaps exactly.\n": "默认情况下，模糊范围恰好覆盖相邻帧之间的运动距离。\n",
  "Lower this setting to reduce blur amount\n": "降低此值可减少模糊程度\n",
  "(simulate faster shutter speed of a camera).": "（模拟相机更快的快门速度）。",
  "Tip:\n": "提示：\n",
  "If you notice that circular camera movement doesn't produce circles,\n": "如果绕圈移动相机时，模糊轨迹没有形成圆形，\n",
  "you can try changing RESHADE_DEPTH_LINEARIZATION_FAR_PLANE to 10000.": "可尝试将 RESHADE_DEPTH_LINEARIZATION_FAR_PLANE 改为 10000。",
  "DB Use Repeating Pattern": "调试：使用重复图案",
  "None": "无",
  "Circle": "圆形",
  "Long Line": "长线",
  "Short Line": "短线",
  "DB Length": "调试：长度",
  "DB Depth Center": "调试：深度中心",
  "DB Depth Range": "调试：深度范围",
  "DB Reverse Background Blur": "调试：反转背景模糊",
  "DB Point To Center": "调试：指向中心",
  "Temporal AA": "时间抗锯齿",
  "Jitter Amount": "抖动幅度",
  "How much to shift every pixel position each frame": "每帧移动各像素位置的幅度",
  "Frame Blend": "帧混合",
  "Higher values reduce blur, but reduce AA as well": "数值越高，模糊越少，但抗锯齿效果也会减弱",
  "Sharpening": "锐化",
  "The amount of sharpening applied": "应用的锐化强度",
  "0 - disabled\n": "0 - 关闭\n",
  "1 - enable high performance Motion Blur\n": "1 - 启用高性能运动模糊\n",
  "2 - enable high quality Motion Blur (recommended)\n": "2 - 启用高质量运动模糊（推荐）\n",
  "7 - debug next motion\n": "7 - 调试下一次运动\n",
  "8 - debug tiles\n": "8 - 调试分块\n",
  "9 - debug motion blur\n": "9 - 调试运动模糊\n",
  "1 - enabled\n": "1 - 开启\n",
  "Many games don't have correct depth on object outlines.\n": "许多游戏的物体轮廓没有正确的深度信息。\n",
  "Enable if you notice with the background blurred, but static character,\n": "如果人物静止、背景模糊时，发现背景的模糊\n",
  "that the background blur is using pixels from the character.\n": "混入了人物像素，请开启此设置。\n",
  "1 - enable the TAA effect.\n": "1 - 启用时间抗锯齿效果。\n",
  "1 - enable the debug view of the motion vectors\n": "1 - 启用运动矢量调试视图\n",
  "2 - blend the debug view with original color\n": "2 - 将调试视图与原始颜色混合\n",
  "0 - don't calculate motion vectors\n": "0 - 不计算运动矢量\n",
  "1 - auto include my motion vectors (highly recommended)\n": "1 - 自动使用此着色器的运动矢量（强烈推荐）\n",
  "2 - manually use iMMERSE motion vectors\n": "2 - 手动使用 iMMERSE 运动矢量\n",
  "3 - manually use other motion vectors (qUINT_of, qUINT_motionvectors, DRME, etc.)\n": "3 - 手动使用其他运动矢量（qUINT_of、qUINT_motionvectors、DRME 等）\n",
  "0 - don't use REST addon for velocity\n": "0 - 不使用 REST 插件获取速度\n",
  "1 - use REST addon to get velocity in generic games\n": "1 - 使用 REST 插件获取通用游戏的速度\n",
  "2 - use REST addon to get velocity in Unreal Engine games\n": "2 - 使用 REST 插件获取 Unreal Engine 游戏的速度\n",
  "3 - use REST addon to get velocity in CryEngine games\n": "3 - 使用 REST 插件获取 CryEngine 游戏的速度\n",
  "Tonemap Mod": "色调映射调整",
  "Lower values increase the HDR range": "数值越低，HDR 范围越大",
  "LUT Settings": "LUT 调色预设设置",
  "LUT Name": "LUT 预设名称",
  "Which LUT to use": "选择要使用的 LUT 调色预设",
  " Creative_Anime": " 创意·动漫",
  " Creative_BleachBypass1": " 创意·跳漂效果 1",
  " Creative_BleachBypass2": " 创意·跳漂效果 2",
  " Creative_BleachBypass3": " 创意·跳漂效果 3",
  " Creative_BleachBypass4": " 创意·跳漂效果 4",
  " Creative_CandleLight": " 创意·烛光",
  " Creative_ColorNegative": " 创意·彩色负片",
  " Creative_CrispWarm": " 创意·清晰暖色",
  " Creative_CrispWinter": " 创意·清晰冬日",
  " Creative_DropBlues": " 创意·淡化蓝色",
  " Creative_EdgyEmber": " 创意·冷峻余烬",
  " Creative_FallColors": " 创意·秋日色彩",
  " Creative_FoggyNight": " 创意·雾夜",
  " Creative_FuturisticBleak1": " 创意·未来荒凉 1",
  " Creative_FuturisticBleak2": " 创意·未来荒凉 2",
  " Creative_FuturisticBleak3": " 创意·未来荒凉 3",
  " Creative_FuturisticBleak4": " 创意·未来荒凉 4",
  " Creative_HorrorBlue": " 创意·恐怖蓝调",
  " Creative_LateSunset": " 创意·暮色夕阳",
  " Creative_Moonlight": " 创意·月光",
  " Creative_NightFromDay": " 创意·日转夜",
  " Creative_RedBlueYellow": " 创意·红蓝黄",
  " Creative_Smokey": " 创意·烟雾",
  " Creative_SoftWarming": " 创意·柔和暖色",
  " Creative_TealMagentaGold": " 创意·青色品红金色",
  " Creative_TealOrange": " 创意·青橙",
  " Creative_TealOrange1": " 创意·青橙 1",
  " Creative_TealOrange2": " 创意·青橙 2",
  " Creative_TealOrange3": " 创意·青橙 3",
  " Creative_TensionGreen1": " 创意·紧张绿调 1",
  " Creative_TensionGreen2": " 创意·紧张绿调 2",
  " Creative_TensionGreen3": " 创意·紧张绿调 3",
  " Creative_TensionGreen4": " 创意·紧张绿调 4",
  " Fuji_Astia_100_Generic": " Fuji_Astia_100（通用）",
  " Fuji_FP-100c_Cool": " Fuji_FP-100c（冷色）",
  " Fuji_FP-100c_Negative": " Fuji_FP-100c（负片）",
  " Fuji_Provia_100_Generic": " Fuji_Provia_100（通用）",
  " Fuji_Velvia_100_Generic": " Fuji_Velvia_100（通用）",
  " Kodak_Ektachrome_100_VS_Generic": " Kodak_Ektachrome_100_VS（通用）",
  " Kodak_Kodachrome_64_Generic": " Kodak_Kodachrome_64（通用）",
  " Polaroid_669_Cold": " Polaroid_669（冷色）",
  " Polaroid_690_Cold": " Polaroid_690（冷色）",
  " Polaroid_690_Warm": " Polaroid_690（暖色）",
  " Polaroid_PX-100UV+_Cold": " Polaroid_PX-100UV+（冷色）",
  " Polaroid_PX-100UV+_Warm": " Polaroid_PX-100UV+（暖色）",
  " Polaroid_PX-680_Cold": " Polaroid_PX-680（冷色）",
  " Polaroid_PX-680_Warm": " Polaroid_PX-680（暖色）",
  " Polaroid_PX-70_Cold": " Polaroid_PX-70（冷色）",
  " Polaroid_PX-70_Warm": " Polaroid_PX-70（暖色）",
  "LUT Chroma": "LUT 色度",
  "Changes the chroma intensity of the LUT": "更改 LUT 调色预设的色度强度",
  "LUT Luma": "LUT 亮度",
  "Changes the luma intensity of the LUT": "更改 LUT 调色预设的亮度强度",
  "Color Palette Swap": "配色替换",
  "Show Palette": "显示调色板",
  "Shows the color at the top left corner": "在左上角显示颜色",
  "Base HSV": "基础色相、饱和度与明度（HSV）",
  "The base hue, saturation and value": "基础的色相、饱和度和明度",
  "Color Harmony": "配色关系",
  "Which harmony to use": "选择要使用的配色关系",
  "Analogous": "相邻色",
  "Complementary": "互补色",
  "Blend Amount": "混合程度",
  "How much to blend the palette with the image": "调色板与画面的混合程度",
  "Bloom": "泛光",
  "Bloom Intensity": "泛光强度",
  "Controls the amount of bloom": "控制泛光的强度",
  "Bloom Radius": "泛光半径",
  "Affects the size/scale of the bloom": "影响泛光的大小与范围",
  "Bloom Max Color": "泛光最大颜色",
  "Percentage of brightest color": "最亮颜色的比例",
  "Show only Sharpening": "仅显示锐化",
  "Sharpening Strength": "锐化强度",
  "Controls the shaprening strength.": "控制锐化强度。",
  "Color Grading": "色彩分级",
  "Temperature": "色温",
  "Changes the white balance temperature.": "更改白平衡的色温。",
  "Tint": "色调",
  "Changes the white balance tint.": "更改白平衡的色调。",
  "Contrast": "对比度",
  "Changes the contrast of the image": "更改画面对比度",
  "Saturation": "饱和度",
  "Changes the saturation of all colors": "更改所有颜色的饱和度",
  "Hue Shift": "色相偏移",
  "Changes the hue of all colors": "更改所有颜色的色相",
  "Color Filter": "颜色滤镜",
  "Multiplies every color by this color": "用此颜色与每种颜色相乘",
  "RGB Mixer Red": "RGB 混色器：红色",
  "Modifies the reds": "调整红色",
  "RGB Mixer Green": "RGB 混色器：绿色",
  "Modifies the greens": "调整绿色",
  "RGB Mixer Blue": "RGB 混色器：蓝色",
  "Modifies the blues": "调整蓝色",
  "Shadows Luma": "阴影亮度",
  "Changes the luma of the shadows mainly.": "主要更改阴影的亮度。",
  "Midtones Luma": "中间调亮度",
  "Change the luma of the midtones mainly.": "主要更改中间调的亮度。",
  "Highlights Luma": "高光亮度",
  "Changes the luma of the highlights mainly.": "主要更改高光的亮度。",
  "Offset Luma": "整体亮度偏移",
  "Changes the luma of whole curve.": "更改整个亮度曲线。",
  "Shadows Color": "阴影颜色",
  "Changes the color of the shadows mainly.": "主要更改阴影的颜色。",
  "Midtones Color": "中间调颜色",
  "Changes the color of the midtones mainly.": "主要更改中间调的颜色。",
  "Highlights Color": "高光颜色",
  "Changes the color of the highlights mainly.": "主要更改高光的颜色。",
  "Offset Color": "整体颜色偏移",
  "Changes the color of the whole curve.": "更改整个曲线的颜色。",
  "1 - enable the Bloom effect\n": "1 - 启用泛光效果\n",
  "9 - debug the Bloom\n": "9 - 调试泛光\n",
  "1 - enable the Sharpen effect\n": "1 - 启用锐化效果\n",
  "1 - enable the use of LUTs\n": "1 - 启用 LUT 调色预设\n",
  "1 - enable color palette generation\n": "1 - 启用调色板生成\n",
  "1 - enable Color Grading effects\n": "1 - 启用色彩分级效果\n",
  "0 - use the cheap tonemapper\n": "0 - 使用简易色调映射器\n",
  "1 - use the full ACES tonemapper (very high performance cost)\n": "1 - 使用完整 ACES 色调映射器（性能开销很高）\n",
  "Exclude Skybox (Bloom)": "排除天空（泛光）",
  "Prevents sky pixels from contributing to bloom.": "防止天空像素参与泛光。",
  "Anamorphic Bloom": "变形镜头泛光",
  "Add More Definition to Bloom Shape (Experimental)": "增强泛光形状的轮廓（实验功能）",
  "Enables a sharper 1D horizontal kernel. May flicker with camera movement.": "启用更锐利的一维水平卷积核。相机移动时可能闪烁。",
  "Scales the intensity of the Bloom effect.": "调整泛光效果的强度。",
  "Bloom Threshold": "泛光阈值",
  "Higher values bloom more of the scene.": "数值越高，场景中产生泛光的区域越多。",
  "Bloom Stretch": "泛光拉伸",
  "Adjusts the horizontal elongation of the Bloom effect.": "调整泛光效果的水平延伸程度。",
  "Bloom Chromatic Shift": "泛光色彩偏移",
  "Shifts R/B channels within the bloom passes.": "在泛光处理中偏移红色与蓝色通道。",
  "Exclude Skybox (Streaks)": "排除天空（光条）",
  "Prevents sky pixels from contributing to light streaks.": "防止天空像素参与光条。",
  "Anamorphic Streaks": "变形镜头光条",
  "Streak Intensity": "光条强度",
  "Scales the intensity of the light streaks.": "调整光条的强度。",
  "Streak Threshold": "光条阈值",
  "Higher values considers more of the scene.": "数值越高，参与效果的场景区域越多。",
  "Streak Stretch": "光条拉伸",
  "Adjusts the horizontal elongation of the light streaks.": "调整光条的水平延伸程度。",
  "Tints the light streaks with chosen color. Set to white (1, 1, 1) for pass-through.": "使用所选颜色为光条着色。设为白色 (1, 1, 1) 可保留原始颜色。",
  "Streak Chromatic Shift": "光条色彩偏移",
  "Shifts R/B channels of the light streaks.": "偏移光条的红色与蓝色通道。",
  "Exclude Skybox: Requires access to properly configured depth buffer.": "排除天空：需要能够访问已正确配置的深度缓冲。",
  "LUMENITE: AnamorphicBloom": "LUMENITE：变形镜头泛光",
  "Artistic bloom & Lens Flare approximating the Anamorphic lens aesthetic.": "模拟变形镜头风格的艺术泛光与镜头光晕。",
  "Split View": "分屏视图",
  "Normals/Depth": "法线／深度",
  "Optical Flow": "光流",
  "Motion Vectors": "运动矢量",
  "Motion Confidence": "运动置信度",
  "Debug View": "调试视图",
  "Kernel": "核心",
  "Surface Relief": "表面浮雕",
  "How much texture gets carved into smoothed normals. sign inverts the relief.": "将纹理细节融入平滑法线的程度。符号可反转浮雕方向。",
  "Texture LOD": "纹理细节层级",
  "1 = finest carving, 2 = fine relief, 4 = broad folds": "1 = 最精细雕刻，2 = 精细浮雕，4 = 宽阔褶皱",
  "LUMENITE: Kernel 2.0": "LUMENITE：核心 2.0",
  "Pre-effect for LumeniteFX shaders.": "LumeniteFX 着色器的前置效果。",
  "Show AO Mask": "显示环境遮蔽遮罩",
  "Debug view for the AO. Shows raw AO.": "环境遮蔽的调试视图，显示原始环境遮蔽。",
  "Ambient Occlusion": "环境遮蔽",
  "AO Range": "环境遮蔽范围",
  "The Z+ range/depth in which the effect is applied.": "应用效果的正深度方向（Z+）范围。",
  "Z+ Fade Start (%)": "正深度方向（Z+）淡出起点（%）",
  "Z+ fraction where effect starts fading out (relative to AO Range)": "开始淡出的 Z+ 比例（相对于环境遮蔽范围）",
  "AO Strength": "环境遮蔽强度",
  "Controls the intensity of the ambient occlusion effect.": "控制环境遮蔽效果的强度。",
  "LUMENITE: LSAO": "LUMENITE：LSAO（大尺度环境遮蔽）",
  "Large-Scale Ray Traced Ambient Occlusion (Screen Space).": "大尺度光线追踪环境遮蔽（屏幕空间）。",
  "LUMENITE: QuantAO": "LUMENITE：QuantAO（快速环境遮蔽）",
  "Fast Ambient Occlusion (Screen Space).": "快速环境遮蔽（屏幕空间）。",
  "LUMENITE: QuantMotion": "LUMENITE：QuantMotion（快速运动矢量）",
  "Superfast motion vectors for ReShade.": "为 ReShade 提供高速运动矢量。",
  "LUMENITE: RTAO": "LUMENITE：RTAO（光线追踪环境遮蔽）",
  "Ray Traced Ambient Occlusion (Screen Space).": "光线追踪环境遮蔽（屏幕空间）。",
  "Smooth Shading": "平滑着色",
  "Slightly smoothens the raw normals. Turn OFF if SMOOTH_NORMALS is enabled in Kernel.": "轻微平滑原始法线。如果已在核心中启用 SMOOTH_NORMALS，请关闭此项。",
  "SSSR Range": "SSSR 反射范围",
  "Z+ fraction where effect starts fading out (relative to Z+ boundary)": "开始淡出的 Z+ 比例（相对于 Z+ 边界）",
  "Ray Resolution": "光线分辨率",
  "Hit Refinement": "命中位置细化",
  "Base Reflectivity (F0)": "基础反射率（F0）",
  "Roughness": "粗糙度",
  "Bump Detail": "凹凸细节",
  "Scale of the extracted bump details. Lower = finer bumps.": "提取的凹凸细节比例。数值越低，凹凸越精细。",
  "Tail Feathering": "尾部羽化",
  "LUMENITE: SSSR": "LUMENITE：SSSR（随机屏幕空间反射）",
  "Stochastic Screen Space Reflections.": "随机屏幕空间反射。",
  "DLAA Prepass: Enabled.": "DLAA 前置处理：已开启。",
  "DLAA Prepass: Disabled.": "DLAA 前置处理：已关闭。",
  "Show Edge Mask": "显示边缘遮罩",
  "Paints the detected edge mask over black background.": "在黑色背景上显示检测到的边缘遮罩。",
  "Edge Detection": "边缘检测",
  "Luma": "亮度",
  "Geometric": "几何",
  "Luma: shading and texture edges as well; the classic DLAA mask.\n": "亮度：也检测着色和纹理边缘，即传统的 DLAA 遮罩。\n",
  "Geometric: silhouettes only, ignores flat UI.": "几何：仅检测轮廓，忽略平面界面。",
  "Temporal Blend": "时间混合",
  "Adaptive Sharpen": "自适应锐化",
  "Sharpen Guard": "锐化限制",
  "Higher = more aggressive sharpening allowed.\nLower = tighter anti-ringing clamp.": "数值越高，允许的锐化越强。\n数值越低，抑制振铃的限制越严格。",
  "High-Frequency Injection": "高频细节补回",
  "Re-injects detail lost during Temporal blend.": "补回时间混合中丢失的细节。",
  "LUMENITE: TRAA": "LUMENITE：TRAA（时间重投影抗锯齿）",
  "Temporal Reprojection Anti-Aliasing.": "时间重投影抗锯齿。",
  "Motion Effects by Vortigern\n": "Vortigern 制作的运动效果\n",
  "Includes: Motion Blur, TAA and Motion Estimation.": "包含：运动模糊、时间抗锯齿和运动估计。"
});

const displayAnnotations = new Set([
  'ui_label', 'ui_tooltip', 'ui_category', 'ui_items', 'ui_text',
]);
const macroFields = Object.freeze({
  UI_FLOAT: [0, 2, 3], UI_FLOAT2: [0, 2, 3], UI_FLOAT3: [0, 2, 3], UI_FLOAT4: [0, 2, 3],
  UI_INT: [0, 2, 3], UI_INT2: [0, 2, 3], UI_INT3: [0, 2, 3], UI_INT4: [0, 2, 3],
  UI_BOOL: [0, 2, 3], UI_COLOR: [0, 2, 3], UI_LIST: [0, 2, 3, 4],
  UI_TIP: [0, 2], UI_HELP: [1],
});

function decodeLiteral(raw) {
  const body = raw.slice(1, -1);
  return body.replace(/\\(?:\r?\n|x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (escape) => {
    const value = escape.slice(1);
    if (value === '\n' || value === '\r\n') return '';
    if (value[0] === 'x') return String.fromCharCode(parseInt(value.slice(1), 16));
    if (/^[0-7]+$/.test(value)) return String.fromCharCode(parseInt(value, 8));
    const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '"': '"', '\\': '\\' };
    return Object.prototype.hasOwnProperty.call(escapes, value) ? escapes[value] : escape;
  });
}

function encodeLiteral(value) {
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\0/g, '\\0').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t').replace(/\u0008/g, '\\b').replace(/\f/g, '\\f') + '"';
}

// A lexer, rather than a semicolon regex, keeps quoted semicolons, escaped quotes,
// concatenated strings, preprocessor branches and comments from changing the span.
function tokenize(source) {
  const tokens = [];
  let position = 0;
  while (position < source.length) {
    const start = position;
    const character = source[position];
    if (/\s/.test(character)) { position++; continue; }
    if (source.startsWith('//', position)) {
      const end = source.indexOf('\n', position + 2);
      position = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', position)) {
      const end = source.indexOf('*/', position + 2);
      position = end === -1 ? source.length : end + 2;
      continue;
    }
    if (character === '"') {
      position++;
      let closed = false;
      while (position < source.length) {
        if (source[position] === '\\') { position += 2; continue; }
        if (source[position++] === '"') { closed = true; break; }
      }
      const raw = source.slice(start, position);
      tokens.push({ kind: closed ? 'string' : 'invalid', start, end: position, raw });
      continue;
    }
    if (/[a-zA-Z_]/.test(character)) {
      position++;
      while (position < source.length && /[a-zA-Z_0-9]/.test(source[position])) position++;
      tokens.push({ kind: 'identifier', start, end: position, raw: source.slice(start, position) });
      continue;
    }
    position++;
    tokens.push({ kind: 'symbol', start, end: position, raw: character });
  }
  return tokens;
}

function directiveEnd(source, start) {
  let end = start;
  while (true) {
    const newline = source.indexOf('\n', end);
    if (newline === -1) return source.length;
    const before = source[newline - 1] === '\r' ? newline - 2 : newline - 1;
    if (source[before] !== '\\') return newline;
    end = newline + 1;
  }
}

function extractDisplayStrings(source) {
  if (typeof source !== 'string') throw new TypeError('Shader source must be a string');
  const tokens = tokenize(source);
  const records = new Map();
  const definitions = new Map();
  const macroDefinitionNames = new Set();
  const pending = [];
  const references = new Set();

  function collect(parts, annotation, group) {
    for (const token of parts) {
      if (token.kind === 'string' && !records.has(token.start)) {
        records.set(token.start, { ...token, value: decodeLiteral(token.raw), annotation, group });
      } else if (token.kind === 'identifier') pending.push({ name: token.raw, annotation, group });
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].raw !== '#' || !tokens[i + 1]) continue;
    const kind = tokens[i + 1].raw;
    if (kind !== 'define' && kind !== 'error' && kind !== 'warning') continue;
    const end = directiveEnd(source, tokens[i].start);
    let next = i + 2;
    while (next < tokens.length && tokens[next].start < end) next++;
    if (kind === 'define' && tokens[i + 2]) {
      const nameToken = tokens[i + 2];
      macroDefinitionNames.add(nameToken.start);
      // Function-like macros require no space between their name and opening '('.
      if (tokens[i + 3]?.raw === '(' && tokens[i + 3].start === nameToken.end) continue;
      if (!definitions.has(nameToken.raw)) definitions.set(nameToken.raw, []);
      definitions.get(nameToken.raw).push(tokens.slice(i + 3, next));
    } else collect(tokens.slice(i + 2, next), '#' + kind, tokens[i].start);
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (displayAnnotations.has(token.raw) && tokens[i + 1]?.raw === '=') {
      let end = i + 2;
      while (end < tokens.length && tokens[end].raw !== ';') end++;
      // An incomplete annotation is preserved instead of consuming unrelated code.
      if (end < tokens.length) collect(tokens.slice(i + 2, end), token.raw, token.start);
    }
    const fields = macroFields[token.raw];
    if (!fields || tokens[i + 1]?.raw !== '(' || macroDefinitionNames.has(token.start)) continue;
    const args = [[]];
    let depth = 1;
    let end = i + 2;
    for (; end < tokens.length; end++) {
      const part = tokens[end];
      if (part.raw === '(') depth++;
      else if (part.raw === ')') {
        depth--;
        if (depth === 0) break;
      }
      if (part.raw === ',' && depth === 1) args.push([]);
      else args[args.length - 1].push(part);
    }
    if (depth !== 0) continue;
    for (const field of fields) {
      const annotation = token.raw === 'UI_HELP' || (token.raw === 'UI_TIP' && field === 2)
        ? 'ui_text' : field === 0 ? 'ui_category' : field === 2 ? 'ui_label'
          : field === 4 ? 'ui_items' : 'ui_tooltip';
      collect(args[field] || [], annotation, token.start + ':' + field);
    }
  }

  for (let i = 0; i < pending.length; i++) {
    const reference = pending[i];
    if (references.has(reference.name)) continue;
    references.add(reference.name);
    for (const body of definitions.get(reference.name) || []) {
      // Resolve display-only object-like macros; never rewrite macro names/bodies
      // containing executable operations, include paths or semantic declarations.
      if (body.every(token => token.kind === 'string' || token.kind === 'identifier' || token.raw === '\\')) {
        collect(body, reference.annotation, '#define:' + reference.name);
      }
    }
  }
  return [...records.values()].sort((a, b) => a.start - b.start);
}

function translateDisplay(value) {
  if (Object.prototype.hasOwnProperty.call(zh, value)) return zh[value];
  // Keep the exact number and placement of option separators, including the final
  // separator required by ReShade. Individual names can share one catalog entry.
  return value.split('\0').map(part => Object.prototype.hasOwnProperty.call(zh, part) ? zh[part] : part).join('\0');
}

// ReShade otherwise displays the technique identifier when no ui_label exists.
// Add labels only for these known techniques; their original identifiers remain
// intact, so presets, enabled state and add-on callbacks continue to match them.
const techniqueDisplayLabels = Object.freeze({
  vort_MotionEffects: 'VORT 运动效果',
  DLSS5_Feed: 'DLSS 5 Feed',
});

function getTechniqueLabelInsertions(source) {
  const tokens = tokenize(source);
  const insertions = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].raw !== 'technique' || tokens[i + 1]?.kind !== 'identifier' || tokens[i + 2]?.raw !== '<') continue;
    const name = tokens[i + 1].raw;
    if (!Object.prototype.hasOwnProperty.call(techniqueDisplayLabels, name)) continue;
    let end = i + 3;
    while (end < tokens.length && tokens[end].raw !== '>' && tokens[end].raw !== '{') end++;
    if (tokens[end]?.raw !== '>') continue;
    if (tokens.slice(i + 3, end).some(token => token.raw === 'ui_label')) continue;
    insertions.push({ technique: name, offset: tokens[i + 2].end,
      annotation: ' ui_label = ' + encodeLiteral(techniqueDisplayLabels[name]) + ';' });
  }
  return insertions;
}

function addTechniqueDisplayLabels(source) {
  let result = source;
  const insertions = getTechniqueLabelInsertions(source);
  for (let i = insertions.length - 1; i >= 0; i--) {
    const entry = insertions[i];
    result = result.slice(0, entry.offset) + entry.annotation + result.slice(entry.offset);
  }
  return result;
}

function translateShader(source, lang = 'zh') {
  if (typeof source !== 'string') throw new TypeError('Shader source must be a string');
  if (!/^zh(?:$|[-_])/i.test(String(lang))) return source;
  const strings = extractDisplayStrings(source);
  let translated = source;
  for (let i = strings.length - 1; i >= 0; i--) {
    const token = strings[i];
    const value = translateDisplay(token.value);
    if (value !== token.value) translated = translated.slice(0, token.start) + encodeLiteral(value) + translated.slice(token.end);
  }
  return addTechniqueDisplayLabels(translated);
}

module.exports = { translateShader, extractDisplayStrings, translateDisplay, addTechniqueDisplayLabels, getTechniqueLabelInsertions, zh };
