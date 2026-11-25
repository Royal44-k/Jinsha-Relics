export function taskSteps(header, labels) {
  const list=document.createElement('ol');
  list.className='task-steps';
  list.setAttribute('aria-label','现场操作顺序');
  const steps=labels.map(label=>{
    const item=document.createElement('li');
    item.textContent=label;list.append(item);return item;
  });
  header.append(list);
  let current=-1;
  function set(index) {
    if(index===current)return;
    current=index;
    steps.forEach((step,i)=>{
      step.classList.toggle('done',i<index);
      if(i===index)step.setAttribute('aria-current','step');
      else step.removeAttribute('aria-current');
    });
  }
  set(0);
  return set;
}
