import Module from 'node:module';
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (typeof request === 'string' && request.toLowerCase().includes('module-federation')) {
    console.error('[probe]', request, '<- parent:', parent && parent.filename);
  }
  return originalLoad.call(this, request, parent, isMain);
};
console.error('[probe] active');
