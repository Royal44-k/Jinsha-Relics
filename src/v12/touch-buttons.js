// A fast swipe on the 3D stage can leave the browser suppressing the click
// following a genuine button tap. Confirm a stationary, in-bounds touch on
// release and consume only its subsequent compatibility click.
export function bindTouchButtons(root,listen,selector){
  const buttonFor=event=>event.target.closest?.(selector);
  let contact=null,lastTap=null;
  listen(root,'pointerdown',event=>{
    if(event.pointerType!=='touch')return;
    const button=buttonFor(event);
    lastTap=null;
    contact=event.isPrimary&&button&&!button.disabled?{id:event.pointerId,x:event.clientX,y:event.clientY,button}:null;
  });
  listen(root,'pointermove',event=>{
    if(contact?.id===event.pointerId&&Math.hypot(event.clientX-contact.x,event.clientY-contact.y)>10)contact.moved=true;
  });
  listen(root,'pointercancel',event=>{
    if(contact?.id!==event.pointerId)return;
    lastTap=contact.id;contact=null;
  });
  listen(root,'pointerup',event=>{
    if(contact?.id!==event.pointerId)return;
    const tap=contact;contact=null;lastTap=tap.id;
    if(tap.moved||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>10||!tap.button.contains(document.elementFromPoint(event.clientX,event.clientY)))return;
    tap.button.click();
  });
  listen(root,'click',event=>{
    if(lastTap===null||!event.isTrusted||!event.detail||event.pointerType!=='touch'||event.pointerId!==lastTap)return;
    event.preventDefault();event.stopImmediatePropagation();lastTap=null;
  },{capture:true});
}

