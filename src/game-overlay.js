'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readNative}=require('./overlays');
// Refuse unsupported routes BEFORE the game installer changes files. OptiScaler
// and the x86 helper architecture are deliberately not advertised as supported.
// The routes the panel can attach to. It rides on ReShade's Direct3D path, so
// what matters is that ReShade is installed under dxgi - which is true of the
// DLSS Tool route as much as of native and Feeder. Leaving it off this list is
// why a game installed that way got no overlay file at all, silently.
function routes(target){return target?.bitness===64&&target.api==='dxgi'&&target.apiLabel!=='DirectX 10'?['native','feeder']:[];}
function prepare({library,target,route}){
  if(!routes(target).includes(route))throw Error('The in-game overlay currently supports 64-bit DX11/DX12 only.');
  const entry=library.resolve('builtin');
  if(!entry.ready)throw Error(`The overlay add-on is missing from this app: ${entry.file}. Antivirus software removes it; restore it and add an exclusion, or reinstall DLSS 5 Swapper.`);
  readNative(entry.file);
  const dir=path.dirname(target.path);
  const records=library.list().installations.filter(r=>r.directory.toLowerCase()===dir.toLowerCase());
  if(records.some(r=>r.overlayId==='builtin'&&r.sha256!==entry.sha256))throw Error('Remove the previous test overlay from the Overlay page before installing the updated build.');
  const file=path.join(dir,`dlss5-lab-overlay-${entry.sha256.slice(0,16)}.addon64`);
  if(fs.existsSync(file)&&(!records.some(r=>r.file===file)||readNative(file).sha256!==entry.sha256))throw Error('An untracked or modified overlay already exists.');
  return {entry,file,alreadyPresent:fs.existsSync(file)};
}
async function attach({library,target,gameDir,manifest,saveManifest,plan}){
  const installed=library.install('builtin',target.path,target.bitness);
  // Only files newly added by THIS game install belong to Restore originals.
  const rel=path.relative(gameDir,installed.file);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Overlay escaped the selected game.');
  if(!plan.alreadyPresent&&!manifest.added.includes(rel))manifest.added.push(rel);
  manifest.labOverlay={sha256:installed.sha256,rel,recordId:installed.id,route:manifest.route,architecture:64};
  try{await saveManifest(gameDir,manifest);}catch(error){if(!plan.alreadyPresent)library.uninstall(installed.id);throw error;}
  return installed;
}
// A rebuilt overlay carries a new hash and a new filename, so the copy from the
// previous build would sit in the game folder forever and make prepare() refuse
// the new one. Only our own tracked, unmodified bytes are removed: uninstall()
// verifies the hash before it deletes anything.
function replaceOutdated(library,exeDir){
  const entry=library.resolve('builtin');
  if(!entry.ready)return;
  const dir=path.resolve(exeDir).toLowerCase();
  for(const record of library.list().installations)
    if(record.overlayId==='builtin'&&path.resolve(record.directory).toLowerCase()===dir&&record.sha256!==entry.sha256)
      library.uninstall(record.id);
}
function cleanupMissing(library,gameDir){
  // Restore already removed tracked bytes. Only stale metadata is discarded.
  for(const record of library.list().installations){
    const rel=gameDir?path.relative(path.resolve(gameDir),record.directory):'';
    if(rel.startsWith('..')||path.isAbsolute(rel))continue;
    if(fs.existsSync(record.directory)&&!fs.existsSync(record.file))library.uninstall(record.id);
  }
}
function completeFeederConfig(text){
  // Pinned v0.12.0 upstream defaults absent from the shared app's cfg template.
  // Never reset a user's existing choice or invent values for unknown builds.
  let result=String(text);
  for(const [key,value] of [['work_upscale','0'],['work_sharpness','0.3']]){
    if(!new RegExp(`^[ \\t]*${key}[ \\t]*=`, 'im').test(result))result=result.replace(/\s*$/,'')+`\r\n${key}=${value}\r\n`;
  }
  return result;
}
module.exports={routes,prepare,attach,replaceOutdated,cleanupMissing,completeFeederConfig};
