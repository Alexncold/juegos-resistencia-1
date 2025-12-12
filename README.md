# Sistema de Reservas - Juegos de Mesa

Sistema web para gestionar reservas de mesas en un local de juegos de mesa. Desarrollado con HTML, CSS y JavaScript vanilla.

## 🎮 Características

### Para Clientes
- **Reserva de Turnos**: Selección de fecha, horario, cantidad de personas y juego
- **Calendario Interactivo**: Solo permite reservar jueves a domingo
- **Fechas Especiales**: Visualización de eventos especiales (Navidad, Año Nuevo, etc.)
- **Carrusel de Novedades**: Noticias y promociones del local
- **Resumen de Reserva**: Vista previa antes de confirmar

### Para Administradores
- **Panel de Administración Protegido**: Login con credenciales específicas
- **Gestión de Reservas**: 
  - Ver todas las reservas en tabla
  - Buscar por nombre o juego
  - Filtrar por rango de fechas
  - Editar reservas (fecha, hora, cliente, juego, personas, estado)
  - Eliminar reservas
- **Gestión de Calendario**:
  - Bloquear/desbloquear fechas
  - Marcar fechas especiales con nombre personalizado
- **Gestión de Novedades**: Crear y eliminar noticias

## 🔐 Acceso

### Cliente
- **URL**: `index.html`
- **Login**: Click en "Iniciar sesión con Google" (simulado)

### Administrador
- **URL**: `admin-login.html`
- **Usuario**: `Resistencia`
- **Contraseña**: `Resistencia2025`

## 📁 Estructura del Proyecto

```
reservas/
├── index.html              # Página principal (clientes)
├── login.html              # Login de clientes
├── admin-login.html        # Login de administradores
├── admin.html              # Panel de administración
├── css/
│   └── style.css          # Estilos globales
└── js/
    ├── storage.js         # Gestión de datos (localStorage)
    ├── app.js             # Lógica de la página de clientes
    ├── admin.js           # Lógica del panel de admin
    └── login.js           # Lógica de login de clientes
```

## 🚀 Instalación y Uso

1. Clonar el repositorio:
```bash
git clone https://github.com/Alexncold/reserva-juegos.git
```

2. Abrir `index.html` en un navegador web

3. Para acceder al panel de admin:
   - Ir a `admin-login.html`
   - Ingresar credenciales de administrador

## 💾 Almacenamiento

El sistema utiliza `localStorage` del navegador para persistir datos:
- Reservas
- Fechas bloqueadas
- Fechas especiales
- Novedades
- Sesiones de usuario

## 🎨 Tecnologías

- **HTML5**: Estructura semántica
- **CSS3**: Diseño responsive con variables CSS
- **JavaScript (Vanilla)**: Sin frameworks externos
- **Material Symbols**: Iconos de Google

## 📱 Responsive

El sistema es completamente responsive y se adapta a:
- Desktop
- Tablet
- Mobile

## 🔧 Funcionalidades Técnicas

- **Calendario Personalizado**: Implementación desde cero con JavaScript
- **Validación de Formularios**: Validación en tiempo real
- **Sistema de Autenticación**: Separación de roles (cliente/admin)
- **Gestión de Estado**: Manejo eficiente con localStorage
- **Modal de Edición**: Interfaz intuitiva para modificar reservas

## 📝 Notas

- Este es un sistema de demostración que usa localStorage
- Para producción se recomienda integrar con un backend real
- Las credenciales de admin están hardcodeadas por seguridad básica

## 👤 Autor

Desarrollado para Resistencia - Local de Juegos de Mesa

## 📄 Licencia

Este proyecto es de uso privado para el local Resistencia.
