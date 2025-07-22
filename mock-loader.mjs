export async function load(url, context, defaultLoad) {
  if (url.includes('node_modules/firebase-admin')) {
    if (url.includes('/app/')) {
      return { shortCircuit: true, format: 'module', source: `export const initializeApp=()=>{};export const cert=()=>{};export const getApps=()=>[];` };
    }
    if (url.includes('/auth')) {
      return { shortCircuit: true, format: 'module', source: `export const getAuth=()=>({verifyIdToken: async()=>({uid:'testuid'})});` };
    }
    if (url.includes('/firestore')) {
      return { shortCircuit: true, format: 'module', source: `export const getFirestore=()=>({collection:()=>({doc:(id)=>({_id:id,set:async(d)=>{(global.__sets||(global.__sets={}))[id]=d;},get:async()=>({exists:true,data:()=>global.__data&&global.__data[id]||{}})})})});` };
    }
  }
  return defaultLoad(url, context, defaultLoad);
}
