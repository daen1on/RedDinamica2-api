function u(e,n){return r=>{let s=r.get(e),t=r.get(n);return t?.errors&&!t.errors.mustMatch||(s?.value!==t?.value?t?.setErrors({mustMatch:!0}):t?.setErrors(null)),null}}export{u as a};
