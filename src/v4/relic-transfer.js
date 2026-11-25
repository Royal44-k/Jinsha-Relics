import { ObjectLoader } from 'three';

// Three's ObjectLoader accepts ArrayBuffers wherever its JSON schema expects
// typed-array values: new Float32Array(buffer) creates a view, not a copy.
// Keep metadata in the native Three schema, but never expand geometry/images
// to huge JS number arrays (Object3D.toJSON's default path does that).
export function packRelicGroup(root) {
  const meta={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}};
  const buffers=new Set();
  function buffer(array) {
    if(!ArrayBuffer.isView(array)||array instanceof DataView)throw new Error('Relic transfer requires typed arrays');
    const value=array.byteOffset===0&&array.byteLength===array.buffer.byteLength?array.buffer:array.slice().buffer;
    buffers.add(value);return value;
  }
  function attribute(a) {
    if(a.isInterleavedBufferAttribute)throw new Error('Interleaved relic attributes are not supported');
    return {itemSize:a.itemSize,type:a.array.constructor.name,array:buffer(a.array),normalized:a.normalized,name:a.name,usage:a.usage};
  }
  root.updateMatrixWorld(true);
  root.traverse(node=>{
    if(node.geometry&&!meta.geometries[node.geometry.uuid]) {
      const g=node.geometry,data={attributes:{},groups:g.groups.map(x=>({...x}))};
      for(const [key,a]of Object.entries(g.attributes))data.attributes[key]=attribute(a);
      if(g.index)data.index=attribute(g.index);
      if(Object.keys(g.morphAttributes).length)throw new Error('Unexpected morph attributes in static relic');
      if(g.boundingSphere)data.boundingSphere=g.boundingSphere.toJSON();
      meta.geometries[g.uuid]={uuid:g.uuid,type:'BufferGeometry',name:g.name,userData:g.userData,data};
    }
    for(const material of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]) {
      for(const value of Object.values(material)) {
        if(!value?.isTexture||meta.images[value.source.uuid])continue;
        if(!value.isDataTexture||!value.image?.data)throw new Error('Only local DataTextures may be transferred with relics');
        const image=value.image;
        // Pre-seed Source.toJSON's cache so native material/texture serialization
        // never calls Array.from(image.data), canvas, fetch or a DOM API.
        meta.images[value.source.uuid]={uuid:value.source.uuid,url:{data:buffer(image.data),width:image.width,height:image.height,type:image.data.constructor.name}};
      }
    }
  });
  const json=root.toJSON(meta);
  json.metadata={version:4.7,type:'Object',generator:'Jinsha relic transferable buffers'};
  for(const key of ['geometries','materials','textures','images'])json[key]=Object.values(meta[key]);
  const transferables=[...buffers];
  return {json,transferables,bytes:transferables.reduce((total,b)=>total+b.byteLength,0)};
}

export function unpackRelicGroup(json) {
  const root=new ObjectLoader().parse(json);
  root.updateMatrixWorld(true);
  return root;
}
