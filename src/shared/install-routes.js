'use strict';

// Keep the sheet and installer on the same compatibility policy. A copied
// nvngx DLL alone does not prove that the game has native NGX calls.
(function (root) {
  function nativeDlssPresent(scan) {
    const file = scan.primaryDlss;
    if (!file) return false;
    const rel = file.rel.replace(/\\/g, '/').toLowerCase();
    return !((scan.install && scan.install.added) || []).some(item => item.replace(/\\/g, '/').toLowerCase() === rel);
  }
  function optiReason(target, api = target && target.api) {
    if (!target || target.bitness !== 64 || target.emulator) return 'optiUnsupported';
    if (!['dxgi', 'vulkan'].includes(api) || target.apiLabel === 'DirectX 10') return 'optiUnsupported';
    if (!target.hasNativeDlss) return 'optiNeedsDlss';
    return null;
  }
  function routesFor(target, api = target && target.api) {
    if (!target || ![32, 64].includes(target.bitness)) return [];
    if (api === 'd3d10' || (api === 'dxgi' && target.apiLabel === 'DirectX 10')) return [];
    // DirectDraw and DX8 both reach modern hardware only through dgVoodoo's
    // 32-bit wrapper, so the Feeder route is the only one either can take.
    if (api === 'd3d8' || api === 'ddraw') return target.bitness === 32 ? ['feeder'] : [];
    if (['d3d9', 'opengl', 'vulkan'].includes(api)) {
      const list = !optiReason(target, api) ? ['feeder', 'optiscaler'] : ['feeder'];
      // The DLSS Tool presents on D3D9 itself - "D3D9 and D3D11 use a
      // same-adapter, device-only D3D12 endpoint" - so it does not need
      // dgVoodoo's translation the way the Feeder route does here. OpenGL and
      // Vulkan are not on its list, and the add-on is 64-bit only.
      if (api === 'd3d9' && target.bitness === 64 && !target.emulator) list.push('renodx');
      return list;
    }
    if (api !== 'dxgi') return [];
    const routes = target.bitness === 32 || target.emulator || target.apiLabel !== 'DirectX 12' ? ['feeder'] : ['native', 'feeder'];
    if (!optiReason(target, api)) routes.push('optiscaler');
    // #251. The DLSS Tool hooks Present, and its own description says what that
    // covers: "Present supports D3D9, D3D11, and D3D12 presentation. D3D9 and
    // D3D11 use a same-adapter, device-only D3D12 endpoint." So DX11 is offered
    // too - it is the larger half of the games with no DLSS of their own, and
    // the reason this route exists. D3D9 goes through dgVoodoo here and is a
    // separate question. 32-bit is out: the add-on is 64-bit only.
    if (target.bitness === 64 && !target.emulator) routes.push('renodx');
    return routes;
  }
  function recommendedRoute(scan, target = scan.chosen) {
    const routes = routesFor(target);
    const nativeDlss = nativeDlssPresent(scan);
    const wanted = scan.install && scan.install.route === 'feeder'
      ? 'feeder' : nativeDlss ? 'native' : 'feeder';
    return routes.includes(wanted) ? wanted : (routes[0] || null);
  }
  const api = { routesFor, recommendedRoute, nativeDlssPresent, optiReason };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.installRoutes = api;
})(typeof window !== 'undefined' ? window : globalThis);
