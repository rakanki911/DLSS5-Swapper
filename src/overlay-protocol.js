'use strict';
const WIDTH = 534, MAX_HEIGHT = 1600;
const FRAME_MAGIC = 0x31464c44, INPUT_MAGIC = 0x31494c44;
const HELLO_VALUE = 0x4c414234, PREVIOUS_HELLO_VALUE = 0x4c414233, OLD_HELLO_VALUE = 0x4c414232, LEGACY_HELLO_VALUE = 0x4c414231;
function helloReply(version = HELLO_VALUE) {
  const reply = Buffer.alloc(24);
  [0x31484c44, 1, version === LEGACY_HELLO_VALUE ? 1 : version === OLD_HELLO_VALUE ? 3 : version === PREVIOUS_HELLO_VALUE ? 7 : 15].forEach((n, i) => reply.writeUInt32LE(n, i * 4));
  return reply;
}
// Fixed-size, little-endian protocol. It transports only UI pixels and input,
// never executable code, paths, scripts or game data.
function frame(bitmap, width, height, sequence) {
  if (width !== WIDTH || !Number.isInteger(height) || height < 1 || height > MAX_HEIGHT || bitmap.length !== width * height * 4) throw Error('Invalid overlay frame');
  const result = Buffer.allocUnsafe(24 + bitmap.length);
  result.writeUInt32LE(FRAME_MAGIC, 0);
  result.writeUInt32LE(1, 4);
  result.writeUInt32LE(sequence >>> 0, 8);
  result.writeUInt32LE(width, 12);
  result.writeUInt32LE(height, 16);
  result.writeUInt32LE(bitmap.length, 20);
  bitmap.copy(result, 24);
  return result;
}
function input(packet) {
  if (packet.length !== 20 || packet.readUInt32LE(0) !== INPUT_MAGIC) throw Error('Invalid input header');
  const action = packet.readUInt32LE(4), x = packet.readInt32LE(8), y = packet.readInt32LE(12), value = packet.readInt32LE(16);
  if (action > 6 || Math.abs(x) > 8192 || Math.abs(y) > 8192 || Math.abs(value) > 0x7fffffff) throw Error('Invalid input');
  if (action === 4 && Math.abs(value) > 1200) throw Error('Invalid wheel');
  if (action === 5 && (value < 0 || value > 22)) throw Error('Invalid key');
  return { action, x, y, value };
}
module.exports = { WIDTH, MAX_HEIGHT, FRAME_MAGIC, INPUT_MAGIC, HELLO_VALUE, PREVIOUS_HELLO_VALUE, OLD_HELLO_VALUE, LEGACY_HELLO_VALUE, helloReply, frame, input };
module.exports.status = value => {
  if (!value || !Number.isInteger(value.epoch) || value.epoch < 1 || value.epoch > 0xffffffff || typeof value.effects !== 'boolean' || !Array.isArray(value.tools) || value.tools.length > 100) throw Error('Invalid runtime status');
  const ids = new Set();
  for (const t of value.tools) {
    if (!Number.isInteger(t.id) || t.id < 1 || t.id > 100 || ids.has(t.id) || ![0, 1, 2].includes(t.kind) || typeof t.available !== 'boolean') throw Error('Invalid tool');
    ids.add(t.id);
    for (const key of ['effect', 'name']) if (typeof t[key] !== 'string' || t[key].length > 128) throw Error('Invalid tool name');
    for (const key of ['min', 'max', 'step', 'value']) if (!Number.isFinite(t[key]) || Math.abs(t[key]) > 2e6) throw Error('Invalid tool range');
    if (t.min >= t.max || t.step <= 0) throw Error('Invalid range');
  }
  const result = { epoch: value.epoch, effects: value.effects, nrAvailable: false, tools: value.tools };
  if (value.nrTools !== undefined) {
    if (!Array.isArray(value.nrTools) || ![11, 15].includes(value.nrTools.length) || typeof value.nrAvailable !== 'boolean' || typeof value.nrEnabled !== 'boolean' || typeof value.nrReason !== 'string' || value.nrReason.length > 160) throw Error('Invalid RenoDX status');
    const checked = module.exports.status({ epoch: value.epoch, effects: value.effects, tools: value.nrTools.map((t, i) => {
      if (t.id !== 101 + i || t.kind !== (i >= 12 ? 4 : [2, 3, 10, 11].includes(i) ? 1 : 0) || t.effect !== 'RenoDX v4.7') throw Error('Invalid RenoDX tool');
      if (t.kind === 4 && (!Array.isArray(t.options) || t.options.length > 16 || t.options.some(s => typeof s !== 'string' || s.length > 128) ||
          !Number.isInteger(t.value) || (t.available && (t.options.length < 2 || t.min !== 0 || t.max !== t.options.length - 1 || t.value < 0 || t.value > t.max)))) throw Error('Invalid RenoDX choices');
      return { ...t, id: i + 1, kind: t.kind === 4 ? 0 : t.kind };
    }) });
    result.nrTools = checked.tools.map((t, i) => ({ ...t, id: 101 + i, kind: value.nrTools[i].kind }));
    result.nrAvailable = value.nrAvailable; result.nrEnabled = value.nrEnabled; result.nrReason = value.nrReason;
  }
  if(value.feedTools!==undefined){
    if(!Array.isArray(value.feedTools)||value.feedTools.length!==8||typeof value.feedPresent!=='boolean'||typeof value.feedReason!=='string'||value.feedReason.length>180)throw Error('Invalid Feeder status');
    const checked=module.exports.status({epoch:value.epoch,effects:value.effects,tools:value.feedTools.map((t,i)=>{
      if(t.id!==301+i||t.kind!==(i===0?1:0)||t.effect!=='Feeder 0.12.0')throw Error('Invalid Feeder tool');return {...t,id:i+1};
    })});
    result.feedTools=checked.tools.map((t,i)=>({...t,id:301+i}));result.feedPresent=value.feedPresent;result.feedReason=value.feedReason;
  }
  return result;
};
module.exports.command = (status, c) => {
  if (!status || !c || c.epoch !== status.epoch || !Number.isInteger(c.id) || !Number.isFinite(c.value)) throw Error('Stale/invalid command');
  const t = c.id >= 301 ? status.feedPresent && status.feedTools?.find(t=>t.id===c.id) : c.id === 200 && status.nrTools ? { kind: 1, min: 0, max: 1, available: true } :
    c.id >= 101 ? status.nrAvailable && status.nrTools?.find(t => t.id === c.id) :
    c.id === 0 ? { kind: 3, min: 0, max: 1, available: true } : status.tools.find(t => t.id === c.id);
  if (!t?.available || c.kind !== t.kind || c.value < t.min || c.value > t.max || (t.kind === 4 ? !Number.isInteger(c.value) : t.kind !== 0 && c.value !== 0 && c.value !== 1)) throw Error('Unsupported command');
  if(c.id>=301&&t.step===1&&!Number.isInteger(c.value))throw Error('Integer Feeder setting required');
  const packet = Buffer.alloc(24);
  [0x31434c44, 1, c.epoch, c.id, c.kind].forEach((n, i) => packet.writeUInt32LE(n, i * 4));
  packet.writeFloatLE(c.value, 20);
  return packet;
};
