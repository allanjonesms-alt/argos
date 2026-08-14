import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const app = initializeApp({
  projectId: "aborda5"
});
const db = getFirestore(app);

async function run() {
  const q = collection(db, 'voluntarios_escala');
  const snap = await getDocs(q);
  console.log("Voluntarios:");
  snap.docs.forEach(doc => console.log(doc.id, doc.data()));

  const escalasQ = collection(db, 'escalas_remuneradas');
  const escalasSnap = await getDocs(escalasQ);
  console.log("Escalas:");
  escalasSnap.docs.forEach(doc => console.log(doc.id, doc.data()));

  const usersQ = collection(db, 'users');
  const usersSnap = await getDocs(usersQ);
  console.log("Users mapping:");
  usersSnap.docs.forEach(doc => console.log(doc.id, doc.data().matricula, doc.data().nome));
}
run();
