/** Protect an in-focus foreground silhouette from a far receiver's blur kernel.
 * Classic BokehShader gathers colour without depth rejection, so a bright crest
 * gets copied into blurred background pixels outside its actual outline. */
export function withDepthAwareGather(source){
 const lookup=/texture2D\(\s*tColor\s*,/g;
 if(!source.includes('float viewZ = getViewZ( getDepth( vUv ) );')||!source.includes('gl_FragColor = col / 41.0;')||!source.includes('void main()'))throw new Error('Unsupported focus shader source');
 const helper=`
 float v9ReceiverDepth;
 vec4 v9FocusSample(const in vec2 uv){
   vec4 neighbour=texture2D(tColor,uv);
   float sharpBand=max(.55,focus*.07);
   if(v9ReceiverDepth-focus<sharpBand*1.8)return vec4(neighbour.rgb,1.);
   float neighbourDepth=-getViewZ(getDepth(uv));
   float sharpForeground=1.-smoothstep(sharpBand,sharpBand*1.8,abs(neighbourDepth-focus));
   float inFront=smoothstep(.12,.7,v9ReceiverDepth-neighbourDepth);
   float weight=1.-sharpForeground*inFront;
   return vec4(neighbour.rgb*weight,weight);
 }
 `;
 // Replace only original colour taps. The helper's unfiltered reads are added
 // afterwards, and the near/in-focus path retains the original shader cost.
 let result=source.replace(lookup,'v9FocusSample(');
 result=result.replace('void main()',helper+'\nvoid main()');
 result=result.replace('float viewZ = getViewZ( getDepth( vUv ) );','v9ReceiverDepth=-getViewZ(getDepth(vUv));\n float viewZ=-v9ReceiverDepth;');
 result=result.replace('gl_FragColor = col / 41.0;','gl_FragColor = col / max(col.a,.001);');
 return result;
}
