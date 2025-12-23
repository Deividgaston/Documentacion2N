# README – Hito 16
Documentación estable + permisos corregidos

## 🎯 Objetivo
Estabilizar completamente el módulo de Documentación, corrigiendo errores de sesión,
carga de media y permisos por rol, dejando una base sólida antes de introducir Diagramas.

---

## ✅ Funcionalidades incluidas

### Documentación
- Carga de documentación gráfica y fichas técnicas desde Firestore.
- La carga NO depende de haber pasado antes por “Gestión de documentación”.
- Funciona al entrar directamente en la pestaña Documentación.
- Separación clara de responsabilidades:
  - Gestión de documentación: subida / borrado.
  - Documentación: uso, selección y exportación.

### Usuarios y permisos
- ACCOUNT_MANAGER puede:
  - Ver documentación.
  - Usar modo comercial.
- Modo técnico protegido por `capabilities.pages.documentacion === "technical"`.
- Export técnico protegido por `capabilities.documentacion.exportTecnico`.
- Sin cierres de sesión al refrescar la página.

### Autenticación / sesión
- Invitaciones aceptadas correctamente.
- Refrescar página NO invalida la sesión.
- Eliminado el bug de “invitación no válida o caducada” tras refresh.

---

## 🧱 No incluido en este hito
- Página de Diagramas.
- Exportación DXF.
- Generación de diagramas por IA.
- Refactor de prescripción (se mantiene intacta a propósito).

---

## 🧪 Estado actual
- Estable.
- Probado con:
  - SUPER_ADMIN
  - ACCOUNT_MANAGER
- Refresco de página seguro.
- Sin dependencias ocultas entre pantallas.

---

## 🚀 Siguientes pasos (Hito 17)
Página Diagramas (IA / DXF)

Propuesta:
1. Nueva pestaña independiente: `diagramas`.
2. Permiso específico: `capabilities.pages.diagramas`.
3. Sin dependencias con prescripción.
4. MVP inicial:
   - Lienzo simple.
   - Elementos / nodos.
   - Exportación base (JSON → DXF en fases posteriores).
