# Design System Técnico basado en shadcn/ui

## 1. Tokens Principales

### Colores (CSS Variables)

``` css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
```

## 2. Tipografía

### Fuente

Inter, sans-serif.

### Escala Tipográfica

  Token       Tamaño   Peso   Line-height
  ----------- -------- ------ -------------
  text-xs     12px     400    1.2
  text-sm     14px     400    1.25
  text-base   16px     400    1.5
  text-lg     18px     400    1.55
  text-xl     20px     400    1.6
  text-2xl    24px     400    1.6

## 3. Border Radius

-   radius-sm: 4px\
-   radius: 8px\
-   radius-lg: 12px

## 4. Bordes

-   Grosor: 1px\
-   Color: hsl(var(--border))

## 5. Espaciado

Basado en Tailwind: 4, 8, 12, 16, 24, 32px.

## 6. Botones

### Estilo Base

``` css
display: inline-flex;
align-items: center;
justify-content: center;
gap: 0.5rem;
padding: 0.5rem 1rem;
font-size: 0.875rem;
font-weight: 500;
border-radius: calc(var(--radius) - 2px);
border-width: 1px;
```

### Tamaños

-   Small: 30px altura\
-   Default: 36px altura\
-   Large: 44px altura

## 7. Inputs

``` css
height: 2.25rem;
padding: 0.5rem 0.75rem;
font-size: 14px;
border-radius: 6px;
border: 1px solid hsl(var(--input));
```

## 8. Cards

``` css
background: hsl(var(--card));
border: 1px solid hsl(var(--border));
border-radius: 8px;
padding: 1.5rem;
```

## 9. Modales

-   Padding: 24--32px\
-   Border radius: 12px\
-   Overlay: rgba(0,0,0,0.5) + blur(4px)

## 10. Sombras

-   shadow-sm: 0 1px 2px rgba(0,0,0,0.05)\
-   shadow-md: 0 4px 6px rgba(0,0,0,0.1)

## 11. Estética General

Minimalista, neutra, calmada, con bordes ligeros, sombras suaves y
enfoque utility-first con Tailwind.
