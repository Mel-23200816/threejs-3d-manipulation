# 🧊 Laboratorio de Demos 3D - Three.js

Un entorno web interactivo estilo Single Page Application (SPA) desarrollado con la biblioteca **Three.js**. Este proyecto integra cinco experiencias 3D independientes en una sola interfaz fluida. Incluye desde generación procedural de terrenos y mini-juegos con físicas (colisiones AABB), hasta edición de materiales hiperrealistas e iluminación dinámica en tiempo real.

---

## 🚀 Tecnologías Utilizadas

Este proyecto fue construido priorizando el uso nativo de módulos ES6 y renderizado WebGL acelerado por hardware a través de Three.js. La interfaz gráfica se diseñó utilizando Bootstrap 5 y UIverse para lograr un estilo moderno con efecto *Glassmorphism*.

![Three.js](https://img.shields.io/badge/threejs-black?style=for-the-badge&logo=three.js&logoColor=white)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![Bootstrap](https://img.shields.io/badge/bootstrap-%238511FA.svg?style=for-the-badge&logo=bootstrap&logoColor=white)

### 📊 Porcentaje de Uso Estimado
* **JavaScript (Three.js Lógica, Físicas y Renderizado):** ~ 80%
* **HTML5 (Estructura SPA y UI):** ~ 10%
* **CSS3 (Glassmorphism, UIverse y ajustes):** ~ 10%

---

## 👨‍💻 Información del Desarrollador

* **Nombre:** Miguel Angel Cano Alejandro
* **Universidad:** Instituto Tecnológico de Pachuca
* **Carrera:** Ingeniería en Sistemas Computacionales
* **Semestre:** 6to Semestre
* **Correo Electrónico:** mcanoalejandro@gmail.com
* **Teléfono:** +52 772 148 6990

---

## 📂 Estructura del Proyecto

La estructura del código fuente y dependencias está organizada de la siguiente manera:
```text
📦 THREEJS-3D-MANIPULATION
 ┣ 📂 assets
 ┃ ┣ 📂 build
 ┃ ┃ ┗ 📜 three.module.js
 ┃ ┣ 📂 css
 ┃ ┃ ┗ 📜 style.css
 ┃ ┣ 📂 img
 ┃ ┃ ┣ 🖼️ atlas.png
 ┃ ┃ ┣ 🖼️ crate.gif
 ┃ ┃ ┣ 🖼️ favicon.png
 ┃ ┃ ┣ 🖼️ hojas.jpg
 ┃ ┃ ┗ 🖼️ tronco.jpg
 ┃ ┣ 📂 js
 ┃ ┃ ┣ 📜 mapControls.js
 ┃ ┃ ┣ 📜 minecraft.js
 ┃ ┃ ┣ 📜 orbitControls.js
 ┃ ┃ ┣ 📜 pointerLockControls.js
 ┃ ┃ ┗ 📜 transformControls.js
 ┃ ┗ 📂 jsm
 ┃   ┣ 📂 controls
 ┃   ┃ ┣ 📜 DragControls.js
 ┃   ┃ ┣ 📜 FirstPersonControls.js
 ┃   ┃ ┣ 📜 MapControls.js
 ┃   ┃ ┣ 📜 OrbitControls.js
 ┃   ┃ ┣ 📜 PointerLockControls.js
 ┃   ┃ ┗ 📜 TransformControls.js
 ┃   ┣ 📂 environments
 ┃   ┃ ┗ 📜 RoomEnvironment.js
 ┃   ┣ 📂 libs
 ┃   ┃ ┣ 📜 lil-gui.module.min.js
 ┃   ┃ ┗ 📜 stats.module.js
 ┃   ┣ 📂 math
 ┃   ┃ ┗ 📜 ImprovedNoise.js
 ┃   ┗ 📂 utils
 ┃     ┗ 📜 BufferGeometryUtils.js
 ┗ 📜 index.html