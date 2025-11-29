// app.js mínimo para comprobar que index + JS externo funcionan

const appRoot = document.getElementById("app");

if (!appRoot) {
  console.error("No existe el div con id='app'");
} else {
  appRoot.innerHTML = `
    <div class="login-container">
      <div class="login-title">PRUEBA LOGIN 2N</div>
      <label>Email</label>
      <input type="email" />
      <label>Contraseña</label>
      <input type="password" />
      <button class="btn btn-blue" style="width:100%;">Entrar (demo)</button>
    </div>
  `;
  console.log("PRUEBA 2N CARGADA DESDE app.js");
}
