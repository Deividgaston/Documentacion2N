// js/ui_login.js
// Pantalla de login simple (Google)

function renderLogin() {
  const root = document.getElementById("app");
  root.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;">
      <div class="card" style="width:360px;">
        <h2 class="page-title">Presupuestos 2N</h2>
        <p class="page-subtitle">Inicia sesión para acceder al generador de presupuestos.</p>
        <button id="btnLoginGoogle" class="btn-primary mt-3">Entrar con Google</button>
      </div>
    </div>
  `;

  document.getElementById("btnLoginGoogle").onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      console.error("Error login Google:", err);
      alert("Error al iniciar sesión. Revisa la consola.");
    });
  };
}

window.renderLogin = renderLogin;
