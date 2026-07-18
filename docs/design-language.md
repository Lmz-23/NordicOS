# NordicOS — Lenguaje de Diseño

## ADN Visual del Proyecto

> **El contrato que firma cada componente nuevo antes de entrar al sistema.**

---

## 0. Nota de método

Este documento describe el lenguaje visual de NordicOS a partir de una imagen canónica del escritorio en su estado más depurado: drakkar vikingo navegando fiordo brumoso, montañas nevadas como telón de fondo, panel superior discreto, dock inferior ceremonial, launcher con marco pronunciado y glifos runicos.

La imagen funciona como retrato oficial. Cualquier pieza nueva del proyecto debe poder sentarse al lado de ese retrato sin desentonar. Si desentonara, este documento está para decir por qué.

> **Validación:** este documento fue redactado inicialmente a partir del brief narrativo consolidado (paleta canónica + decisiones de memoria compartida) y luego enriquecido con análisis visual directo de la captura canónica. Las observaciones pixel-a-pixel sirvieron para anclar reglas que el brief solo sugería y para descubrir patrones que no estaban en la narrativa previa (sparklines, política de iconografía mixta en zonas de marca, contraste tipográfico ceremonial del calendario, triple presencia del Valknut). El documento se firma contra la imagen, no contra el brief.

---

## 1. Manifiesto

NordicOS es la interfaz de un mundo que ya pasó.

No se trata de evocar nostalgia con fuegos cálidos y tonos dorados: se trata de habitar el momento anterior a la batalla, cuando el mar todavía está quieto y la nieve aún no ha manchado con rojo. La interfaz es la bitácora del navegante: herramientas funcionales marcadas con el cincel del herrero, no la ornamentación del cortesano.

Lo que el usuario ve al sentarse frente al escritorio es lo que vería un vigía en la proa: un panel de control austero, una paleta de hierro y escarcha, una tipografía que corta, una iconografía que ya tenía significado antes de que el sistema operativo existiera. El sistema operativo no inventa el lenguaje — lo hereda.

Tres frases que resumen la intención:

- **Hierro sobre escarcha.** Materiales fríos, densos, con peso. Nada brilla por accidente.
- **El mar manda.** El fondo del mundo es paisaje, no decoración. La UI flota sobre él, no lo tapa.
- **Cada módulo merece su solemnidad.** No todo es ceremonial; pero nada es trivial.

---

## 2. Sensación psicológica

Mirar NordicOS debe sentirse como:

- **Mirar al mar desde una roca.** Calma con borde. Hay peso, hay profundidad, hay expectativa.
- **Aceptar que hace frío.** No hay tibieza falsa. La interfaz no intenta abrazarte; te da instrumentos.
- **Estar en un lugar con historia.** El sistema no nació ayer; los símbolos que usa ya significaban algo antes de que él apareciera.
- **Tener autoridad silenciosa.** Ningún elemento grita. Todo está donde debe estar.

Lo que NordicOS **nunca** debe transmitir:

- Calidez hogareña (no es una cabaña).
- Cómic o fantasía ligera (no es un RPG).
- Nostalgia ochentera de neón (no es cyberpunk).
- Minimalismo aséptico tipo startup (no es un SaaS).
- Brutalismo agresivo sin oficio (no es anti-diseño por deporte).

**Regla emocional para cualquier componente nuevo:** antes de aprobar un módulo, pregúntate si transmitiría calma con peso frente al drakkar. Si lo que transmite es bullicio, ternura, ansiedad o vacío corporativo, no pertenece.

---

## 3. Metáfora fundacional

La raíz narrativa es **la nave en el fiordo**. Todo el lenguaje se sostiene sobre esa escena única:

- **El mar** = el fondo del escritorio (wallpaper). Es paisaje, no decoración. Es silencioso, es profundo, es lo que ya estaba allí antes de que llegara la interfaz.
- **La proa del drakkar** = los elementos principales de UI. Tallados, marcados, con peso. Protagonistas que cortan el horizonte.
- **Los remos** = controles secundarios. Repetidos, ordenados, paralelos. No piden atención pero siempre están listos.
- **El mascarón de proa** = el launcher. Lo más ornamentado del sistema. La única zona donde la talla es explícita. Es lo que mira al frente cuando la nave está quieta.
- **Las cuerdas y nudos** = separadores, bordes, conectores. Artesanales, no industriales.
- **La niebla** = el aire entre paneles. Translucidez, profundidad, separación sin línea dura.
- **La cordillera lejana** = contexto, escala. Lo que nunca se toca, lo que da proporción.
- **Los cuervos** = notificaciones, alertas, eventos. Pocas, precisas, memorables.
- **Las runas en la madera** = tipografía ceremonial. Letras que ya significaban algo antes de ser texto.

**Mundo que habitamos:** una cubierta de drakkar al amanecer boreal. El sistema operativo no se ambienta en un mundo vikingo — se ambienta en un instante específico de ese mundo: el instante antes de zarpar.

**Continuidad wallpaper ↔ UI:** la vela del drakkar lleva pintado el Valknut. Ese mismo Valknut aparece en la barra superior (extremo izquierdo) y en el dock. Es el *sello* del proyecto, no un motivo decorativo aislado: dialoga con el wallpaper sin repetirlo. La UI no compite con la escena — la escena ya contiene al sistema, y el sistema lo sabe.

---

## 4. Materiales aparentes

Sin texture maps, solo por color, brillo y contexto. La paleta canónica ya nombra los materiales en sus comentarios; aquí se expande la lectura para cada rol.

### 4.1 Tabla de materiales por rol de UI

| Rol de UI | Material probable | Por qué |
|---|---|---|
| Fondo principal (`bg`) | Hierro fundido en frío | Negro azulado, sin calor, denso. La superficie que sostiene todo sin pedir nada. |
| Panel elevado (`surface`) | Madera de roble sellada al aceite oscuro | Apenas un escalón más claro que el fondo. Calidez contenida — el único guiño cálido del sistema, y aún así oscuro. |
| Superficie alternativa (`surface-alt`) | Cuero curtido y bruñido | Aparece en hover, en estados activos. Tiene textura implícita aunque no se vea: es lo que la mano del navegante toca más. |
| Borde principal (`border`) | Acero forjado en frío | Ligeramente desaturado, tirando a gris azulado. El borde marca sin cortar; está ahí para delimitar, no para llamar la atención. |
| Acento principal (`accent`) | Hielo glaciar bajo luz oblicua | Azul brillante con cuerpo. No es luz de neón — es mineral: frío y denso aunque parezca translúcido. |
| Acento secundario (`accent-soft`) | Nieve iluminada por amanecer | Más pálido, menos saturado. Sirve para amables, no para señalar. |
| Texto principal (`text`) | Hueso blanco tallado | Ligeramente cálido para no quemar, pero sin ser cremoso. Como escritura sobre hueso o marfil. |
| Texto secundario (`text-muted`) | Tinta diluida en agua | Gris azulado que retrocede. Sirve para label y metadata — debe ser leído cuando se busca, no cuando se pasa. |
| Éxito (`success`) | Musgo sobre roca | Verde apagado, no esmeralda. Éxito sin euforia. |
| Advertencia (`warning`) | Latón viejo / oro deslucido | Amarillo pardo. No es dorado de premio — es el metal de una hebilla usada durante décadas. |
| Error (`error`) | Sangre seca sobre acero | Rojo oscuro, casi marrón. Duele, pero no es escandaloso. |

### 4.2 Lectura material por superficie

**Barra superior (Waybar):** madera sellada flotando sobre acero. La superficie es superficie de cubierta, no superficie tallada.

**Dock inferior:** madera más oscura, casi en sombra. Está más cerca de la línea de flotación; es parte de la obra viva del barco.

**Launcher (Wofi):** la pieza de talla. Aquí el material pasa de madera sellada a madera tallada: bordes prominentes, marco como artesa, glifos con relieve implícito. Es el mascarón de proa, no la cubierta.

**Terminal:** más cerca del metal que de la madera. El usuario teclea sobre acero. El fondo del terminal comparte el tono del fondo principal — no contrasta con él, lo continúa.

**Wallpaper:** paisaje. No se le asigna material artificial — es el mundo mismo.

---

## 5. Geometría y proporciones

### 5.1 Radios de esquina

| Contexto | Radio esperado | Razón |
|---|---|---|
| Paneles discretos (Waybar, dock) | Suavizado ligero (≈ 4–8 px) | Bordes que sugieren manufactura, no inyección de plástico. |
| Panel ceremonial (launcher) | Más marcado (≈ 8–12 px) | Lo único que se permite tener "peso de marco". |
| Tarjetas internas, separadores | Esquina viva o casi viva (0–2 px) | Dentro de un panel ya curado, los hijos pueden ser rectos: contraste jerárquico. |
| Iconos | Geometría ligeramente suavizada | Ni cuadrado perfecto ni círculo — talla, no pictograma. |
| Botones y entradas | Vivo, sin redondeo decorativo | No es iOS. No es Android. Es herramienta. |

**Regla general:** más ceremonial = más redondeado; más utilitario = más recto. El redondeo es un privilegio, no un default.

### 5.2 Grosores de borde

| Contexto | Grosor esperado | Lectura |
|---|---|---|
| Separador invisible entre módulos adyacentes | Hairline (1 px) | Sugiere costura, no pared. |
| Borde de panel discreto (Waybar) | 1 px | Marca la silueta sin pedir atención. |
| Borde de launcher / panel ceremonial | 2 px | Cuadruplica presencia. Anuncia "esta zona es distinta". |
| Línea de selección / focus indicator | 2–3 px con presencia asimétrica (ej. solo a la izquierda) | Decisión, no decoración. |
| Borde ornamental en zonas rituales (login, splash) | 1 px con ornamentación geométrica a los lados | La línea es solo el esqueleto; lo que importa es el motivo al lado. |

**Regla de hierro:** no existe el "borde 1.5 px". Elige 1 o elige 2. El punto medio es indecisión.

### 5.3 Densidad de información

NordicOS es **denso donde debe, vacío donde puede**. La barra superior tiene mucha información por pulgada — workspaces, ventanas, música, redes, batería, hora — y se ve contenida, no saturada. ¿Por qué? Porque el contenedor está bien tallado: padding interno generoso, jerarquía de pesos tipográficos, íconos pequeños, módulos separados por aire en lugar de líneas.

**Principio:** la densidad es aceptable cuando el módulo la administra con ritmo. Es inaceptable cuando el módulo la acumula sin separar.

### 5.4 Ritmo vertical y horizontal

- **Vertical:** la barra superior delgada y baja contrasta con un dock inferior más alto. Hay dos alturas en el sistema: la del instrumento (arriba) y la del ancla (abajo). Nunca tres.
- **Horizontal:** los módulos a la derecha de la barra superior están más juntos entre sí que los del centro. Es como un remate: los remos del centro están espaciados para el braceo; los del flanco se compactan contra el casco.

### 5.5 Proporciones entre módulos

Hay **un módulo dominante** (la pieza de música, el centro de gravedad) y **módulos satélites** (workspaces a la izquierda como un ancla solitaria, módulos de estado a la derecha agrupados como un racimo). El centro manda; los satélites orbitan. Esta es la disposición del cuerpo en una cubierta: un punto focal claro, periféricos agrupados.

### 5.6 Padding interno vs. margin externo

- **Padding interno de un panel:** generoso. La pieza debe respirar como madera trabajada, no como widget de Bootstrap.
- **Margin externo entre módulos:** casi nulo dentro de un mismo panel (separación por aire, no por borde). Holgado entre paneles distintos (espacio como niebla).
- **Regla de los 8:** todo espaciado es múltiplo de una unidad base (4 px o 8 px). No se inventan valores arbitrarios. La cuadrícula existe aunque no se vea.

---

## 6. Marcos y separación

NordicOS rara vez grita con bordes. La separación se construye por capas:

### 6.1 Mecanismos de delimitación (en orden de aparición)

1. **Diferencia de elevación tonal** — el panel es más claro que el fondo. Esta es la primera separación, la que casi no se nota pero basta.
2. **Translucidez controlada** — el panel deja ver lo que hay detrás (niebla, mar, montaña), filtrado y oscurecido. Separa sin tapar.
3. **Hairline de borde** — cuando hace falta afirmar el límite, se usa una línea de 1 px en tono acero.
4. **Marco ceremonial (2 px + ornamentación)** — reservado al launcher y a zonas rituales. Aquí sí se permite que el marco hable.

### 6.2 Cuando no hay marco

En la barra superior, el módulo de workspaces a la izquierda no tiene marco propio: flota como una pieza suelta del mosaico. Esto es deliberado. La obra viva de la proa no tiene moldura — está trabajada directo en la madera.

### 6.3 La translucidez como aire

Los paneles translúcidos dejan que el wallpaper sea protagonista del fondo. El usuario debe poder ver el fiordo a través de la cubierta. Pero la translucidez debe ser **filtrada**, no cruda: si se ve el fondo tal cual, el sistema parece un velo; si se filtra con un tinte sutil del color de la madera, parece atmósfera.

### 6.4 Primer plano vs. fondo sin ser obvio

- **Fondo:** wallpaper (paisaje). Siempre presente. Siempre el mismo peso visual.
- **Primer plano:** paneles. Se distinguen por *tinte* (más cálido o más frío que el fondo), no por *marco*. El usuario nunca debe sentir que la UI está "encima" del mundo — debe sentir que es parte de él.

### 6.5 Excepciones documentadas al sistema de marcos

Tres superficies confirman la regla rompiéndola de forma intencionada. Cada excepción está justificada por su rol narrativo:

| Superficie | Excepción | Justificación |
|---|---|---|
| **Barra superior (waybar)** | Sin marco visible. Solo background sutil con tinte. | El instrumento de cubierta no se enmarca: está *trabajado directo* en la madera. La obra viva no necesita moldura. La separación se construye por aire entre módulos. |
| **Dock inferior** | Sin marco ceremonial, pero con presencia de marca (iconos grandes, espaciado generoso). | El ancla no se ornamenta — su peso viene de su rol, no de su marco. Los iconos son el lenguaje, no la talla. |
| **Icono Valknut del sistema** | Aparece en tres superficies (waybar, dock, vela del drakkar en el wallpaper) sin marco contenedor. | El logo del proyecto es un *sello*, no un panel. Los sellos no se enmarcan: se imprimen. La triple presencia (waybar → dock → wallpaper) crea continuidad de identidad sin necesidad de contenedor. |

**Regla derivada:** toda excepción debe poder explicarse narrativamente. Si una superficie pide salirse del sistema de marcos y no puede justificarlo como instrumento/ancla/sello, vuelve al sistema.

---

## 7. Jerarquía visual

### 7.1 Lo que se ve primero, segundo y tercero

**Primero:** el wallpaper. Siempre. Es el horizonte. La UI no compite con él: orbita.

**Segundo:** el módulo central superior (música). Es la proa. Lo que mira al frente. Lo más grande del rim, lo más tipográficamente presente, lo más cuidadosamente jerarquizado.

**Tercero:** el dock inferior. Es el ancla. Confirma dónde está el peso.

**Cuarto:** los satélites (workspaces a la izquierda, sistema a la derecha). Son remos yobenques: necesarios, reconocibles, secundarios.

### 7.2 Cómo se establece la jerarquía sin recurrir al tamaño

En NordicOS, la jerarquía se construye por **densidad visual**, no por dimensión:

- Un módulo jerárquico superior tiene **texto más grande + más espacio en blanco + menos elementos por unidad**.
- Un módulo secundario tiene **texto más pequeño + más elementos por unidad + más continuidad visual con su vecino**.
- Esto significa que un módulo de 80 px de alto puede dominar a uno de 100 px si su composición es más respirada.

### 7.3 Información primaria, secundaria y terciaria

| Nivel | Cómo se distingue |
|---|---|
| **Primaria** | Tamaño mayor + tinte de acento + posición focal |
| **Secundaria** | Tamaño medio + texto principal (hueso) + posición orbital |
| **Terciaria** | Tamaño pequeño + texto muted (tinta diluida) + agrupada a su primaria |

**Nunca** se distingue la jerarquía solo por color (problemas de accesibilidad) ni solo por tamaño (ruido visual). Siempre combinación.

### 7.4 La disposición como declaración

Workspaces a la izquierda solitaria: el ancla que mira al pasado (qué ventanas tengo abiertas).
Música en el centro: lo que el navegante escucha, el ahora del viaje.
Estado a la derecha agrupada: lo que el barco necesita saber sobre sí mismo (red, energía, hora).
Dock abajo: las herramientas a mano, los remos al alcance.

La barra superior cuenta la historia de un viaje en orden de izquierda a derecha. El dock es el inventario. El launcher es el mascarón. Cada zona tiene un porqué narrativo, no solo funcional.

---

## 8. Ritmo visual

### 8.1 Frecuencia de elementos

- **Repetición alta:** los puntos de estado (leds pequeños, iconos diminutos de wifi/batería). Son los remos — repetidos, predecibles.
- **Repetición media:** separadores, líneas de módulo, grupos tipográficos similares.
- **Repetición baja:** motivos ornamentales (Valknut, runas). Estos aparecen, no se repiten. Cuando un Valknut aparece, se siente.

### 8.2 Motivos que se repiten y motivos que rompen

- **Repetidos:** líneas horizontales finas como costuras, módulos rectangulares del mismo tono, iconos del mismo grosor.
- **Rupturas intencionales:** el launcher cuando aparece (rompe la quietud), una alerta con acento cálido (rompe la frialdad), el módulo de música con texto más grande (rompe la escala).

La regla: la repetición construye ritmo; la ruptura lo hace memorable. Un sistema sin repeticiones es nervioso; un sistema sin rupturas es monótono.

### 8.3 Equilibrio repetición/sorpresa

- **90% del tiempo:** ritmo predecible. El usuario sabe dónde está cada cosa.
- **10% del tiempo:** un detalle inesperado que recompensa la atención prolongada.

NordicOS es un sistema para vivir, no para impresionar al primer segundo. El lujo está en la segunda vista.

---

## 9. Tipografía

### 9.1 Carácter

NordicOS admite (y combina deliberadamente) **tres caracteres tipográficos**:

| Carácter | Uso | Ejemplo emocional |
|---|---|---|
| **Sans compacto humanista** | Módulos de estado, nombres, labels | "Mecanografía del navegante: rápido, claro, sin floritura." |
| **Monospace técnica** | Terminal, código, datos numéricos | "La cota de malla del texto: protege, contiene, no decora." |
| **Display runico / ceremonial** (poco, bien dosificado) | Launcher, splash, login, zonas rituales | "La talla en la proa: lo único que se permite tener voz propia." |

### 9.2 ¿Es coherente la coexistencia?

Sí, y es **parte del lenguaje**. La cubierta tiene texturas distintas: el suelo es madera trabajada (sans humanista), las cuerdas son fibras paralelas (monospace), la proa tiene talla (display). Una cubierta de drakkar con un solo material sería un plano, no un barco.

**Pero:** la coexistencia debe estar jerarquizada. El display runico solo aparece en zonas ceremoniales. Si aparece en un módulo de estado, pierde su valor.

### 9.3 Peso

- **Texto principal:** regular (no bold). La interfaz no necesita que le griten sus textos.
- **Texto destacado:** medium o semibold, **nunca black**. Pesos pesados gritan; NordicOS habla en voz baja.
- **Texto ceremonial:** puede ser bold pero en tamaño mayor — la solemnidad viene del tamaño, no del peso bruto.

### 9.4 Tamaño para jerarquía (no para decoración)

| Nivel | Tamaño relativo | Por qué |
|---|---|---|
| Display ceremonial | Muy grande | Anuncia zona ritual. Se usa una vez por pantalla máximo. |
| Título de módulo | 1.4–1.8x base | Marca el "ahora". |
| Contenido | 1x (base) | El cuerpo del trabajo. |
| Metadata / label | 0.85–0.9x | Lo que se busca, no lo que se mira. |

Nunca más de tres tamaños en una misma superficie. Más de tres tamaños = ruido visual.

### 9.5 Tracking, leading, transformaciones

- **Tracking:** normal para sans, ligeramente abierto (+20–50) para monospace pequeño (legibilidad).
- **Leading:** generoso. 1.4–1.6 para texto corrido. Más apretado solo para labels cortos.
- **Transformaciones:** uppercase permitido solo en zones ceremoniales o labels muy cortos (estados). Nunca en texto corrido. Lowercase por defecto en metadata. Title case para títulos de módulo.

### 9.6 Contraste tipográfico ceremonial (excepción a la regla de tres tamaños)

La regla general dice: nunca más de tres tamaños en una misma superficie. Pero existe **una excepción ceremonial** donde el contraste se exagera a propósito:

**Patrón "label pequeño / número ceremonial / label pequeño":**
- Label superior: 11–12 px, sans compacto, uppercase, accent-soft o text-muted
- Número central: 48–72 px (4–6x el label), sans compacto o display, peso medium/semibold, color text principal
- Label inferior: 13–14 px, sans compacto, uppercase, text-muted

**Uso:** widgets donde un dato aislado es protagonista absoluto (calendario, reloj ceremonial, contador de versión, contador de workspaces en panel lateral, splash).

**Cuándo se permite:** solo en zonas de solemnidad 2 o 3 (panel de calendario, splash, lock screen). Nunca en zonas utilitarias.

**Por qué funciona:** el contraste extremo *anuncia* el dato. El navegante que mira el calendario no necesita ver tres cosas: solo necesita saber qué día es, en grande. La jerarquía se invierte: el dato manda, el contexto lo enmarca.

**Cuándo NO usarlo:**
- En waybar (información densa, contraste bajo es rítmico).
- En menús (la comparación de opciones se rompe con contraste extremo).
- En cualquier superficie con más de un dato protagonista.

---

## 10. Iconografía

### 10.1 Estilo

NordicOS usa un **estilo coherente y disciplinado**, no una mezcla:

- **Glyph line (línea uniforme):** el grueso del sistema. Trazos del mismo grosor, esquinas apenas suavizadas, sin relleno.
- **Glyph runico:** permitido en zonas ceremoniales (Valknut, ᚠ ᚢ ᚦ, runas puntuales).
- **Glyph musical / simbólico:** específico del módulo de audio. Nota, pausa, playlist — símbolos que también tienen historia.

**Nunca:** duotone, fill sólido genérico, emojis decorativos, iconos de distintos proveedores mezclados.

### 10.2 Tamaño relativo

| Zona | Tamaño de icono | Comentario |
|---|---|---|
| Barra superior | 14–16 px | Ícono como marca tipográfica, no como pictograma. |
| Dock inferior | 20–24 px | Más grandes porque están más lejos (arriba) o son interactivos (abajo). |
| Launcher | 28–32 px | La talla grande. La iconografía aquí puede ser un glifo ceremonial. |
| Notificaciones | 14–18 px | Íconos puntuales, casi tipográficos. |

### 10.3 Relación entre iconos

Todos del mismo grosor de trazo. Todos con el mismo nivel de detalle (nunca un icono lleno de detalle al lado de uno mínimo). Si hay un símbolo runico en una zona, no debe haber un símbolo pictórico de otro estilo al lado.

### 10.4 ¿Hay un alfabeto visual implícito?

Sí. Tres niveles:

1. **Glifos de sistema** (wifi, batería, volumen, hora): sans, line, uniformes. Son las herramientas.
2. **Glifos musicales** (♫, ♪, ⏸, ⏵): símbolos con historia, usados en módulo de audio. Son el placer.
3. **Glifos runicos / Valknut** (ᚠ ᚱ ᚲ ᚦ, etc.): reservados para ceremoniales. Son la memoria.

Un usuario que mire NordicOS con atención debería poder distinguir estos tres niveles sin leer documentación.

### 10.5 Política de iconografía mixta en zonas de marca (excepción documentada)

La regla §10.3 ("todos del mismo estilo y grosor") es la regla general, pero existe **una excepción precisa**: cuando un componente agrupa aplicaciones externas con identidad de marca propia (típicamente el dock inferior), la marca de la app **se respeta** si cumple estas condiciones:

**Cuándo se acepta un logo oficial de app (en lugar del glifo genérico):**
- El logo es distintivo y legible al tamaño del dock (20–24 px).
- El logo representa una aplicación con marca pública (Brave, Neovim, Discord, Spotify, Kitty, Dolphin, etc.).
- El logo es monocromo o de dos tonos compatibles con la paleta (verificable: ¿se lee claramente en `text` y en `text-muted`?).
- El logo no introduce un nuevo estilo gráfico que rompa la consistencia visual (los logos acceptedos comparten lenguaje: line/fill minimalista, sin texturas pesadas, sin degradados).

**Cuándo NO se acepta:**
- La app tiene un logo visualmente "ruidoso" (degradados, fotografías, detalles finos que se pierden al tamaño).
- El logo usa un color que choca con la paleta (ej. naranja saturado sobre `surface` translúcido).
- Hay más de un logo "de marca" en la misma zona sin un patrón discernible (la mezcla debe contar una historia, no ser aleatoria).

**Política de fallback:** si un logo no cumple las condiciones, el dock debe usar el glifo genérico del sistema (un pictograma line en `text-muted`). La marca no es más importante que el lenguaje.

**Test del observador externo:** un usuario que ve el dock debería poder distinguir, sin leer documentación, qué iconos son "apps con marca" y cuáles son "acciones del sistema". Si no puede, la mezcla está mal calibrada.

---

## 11. Color y atmósfera

> **Este documento no repite hex específicos.** Habla del uso, el peso y la temperatura de cada rol.

### 11.1 Cómo se siente cada color en contexto

- **bg (hierro fundido):** denso, no brillante. La interfaz no se asienta sobre este color; se sumerge en él.
- **surface (roble sellado):** apenas un grado más cálido. Es la superficie que tocas — no la ves, la sientes.
- **surface-alt (cuero bruñido):** aparece cuando algo reclama atención sin gritar. Es el cuero del guante del navegante.
- **border (acero frío):** nunca protagonista. Está ahí para confirmar límites. Si lo notas, es porque algo falló.
- **accent (hielo glaciar):** lo único que se permite ser luminoso. Y aún así, luminoso como mineral, no como bombilla.
- **accent-soft (nieve iluminada):** el acento amable. Para focus rings, para hover suaves, para acompañar sin reemplazar.
- **text (hueso tallado):** el cuerpo de la información. Nunca blanco puro (eso es papel de impresora). Nunca amarillento (eso es vela).
- **text-muted (tinta diluida):** la voz baja. Está para ser encontrada, no para ser oída.
- **success (musgo):** éxito sin celebración. Como una bandera de taller izada sin fanfarria.
- **warning (latón viejo):** atención sin alarma. Como una herramienta que ya muestra uso.
- **error (sangre seca):** dolor, no espectáculo. Como una herida que el navegante sabe tratar.

### 11.2 Jerarquía cromática

| Saturación | Uso |
|---|---|
| **Muy desaturado** (casi gris) | Bordes, separadores, backgrounds. Cosas que delimitan, no comunican. |
| **Desaturado moderado** | Texto muted, paneles secundarios. Lo que respalda. |
| **Saturación media** | Texto principal, íconos de sistema, módulos estándar. El cuerpo. |
| **Saturación alta (única permitida)** | El acento de hielo. Lo único que tiene "luz". |

**Regla:** el acento es el único color con saturación alta. Todo lo demás es contenido. Si dos elementos compiten por atención cromática, uno de los dos está mal calibrado.

### 11.3 Paneles translúcidos y wallpaper

Los paneles translúcidos *filtran* el wallpaper, no lo exponen. Hay tres formas de lograrlo:

1. **Tinte sutil:** el panel tiene un baño tonal del color de la madera de fondo. El wallpaper se ve, pero atemperado.
2. **Blur mínimo:** si se usa, debe ser ligero. Blur agresivo = velo de plástico, no niebla.
3. **Desenfoque por luminancia:** el panel baja el contraste de lo que está detrás sin tocar el color. Atmósfera, no cristal.

El wallpaper nunca debe verse a través de un panel con la misma intensidad que sin él. Si se ve igual, el panel no está haciendo su trabajo.

### 11.4 ¿El wallpaper manda o los paneles mandan?

**El wallpaper manda siempre.** Pero no por jerarquía explícita — por jerarquía implícita. Los paneles son instrumentos de cubierta; el wallpaper es el mar y la montaña. La cubierta no compite con el mar. Lo usa.

**Excepción:** cuando la UI pide atención absoluta (alerta crítica, comando bloqueante), el panel *temporalmente* sube su opacidad. Aún así, no tapa el wallpaper: lo empuja a un segundo plano por luminancia.

### 11.5 Combinaciones de color por contexto

El sistema vive en distintos "momentos del día" y cada momento pide una combinación ligeramente distinta. No son modos automáticos — son recomendaciones para que el usuario pueda ajustar conscientemente.

| Contexto | bg | surface | Acento | Atmósfera |
|---|---|---|---|---|
| **Amanecer boreal** (default) | hierro frío | roble sellado | hielo glaciar | quietud previa a la partida |
| **Mediodía brumoso** (trabajo profundo) | hierro un punto más oscuro | roble más cálido | hielo apagado | concentración sin distracción cromática |
| **Anochecer** (lectura) | hierro profundo | superficie casi plana con bg | acento-soft | reposo, vista cansada |
| **Tormenta** (alerta visual) | bg puro, sin tinte | surface elevado | acento más frío, casi blanco | urgencia contenida |

**Regla:** el sistema no debe ofrecer un "modo claro" — NordicOS no vive de día. Si el usuario necesita más brillo, ajusta la luminancia del monitor, no cambia de paleta.

### 11.6 Combinaciones prohibidas

- ❌ Acento sobre surface-alt (demasiado contraste, pierde jerarquía).
- ❌ Texto muted como texto principal (legibilidad comprometida).
- ❌ Error como acento (el dolor no es marca).
- ❌ Success como borde (verde en exceso).
- ❌ Dos acentos compitiendo en la misma superficie.
- ❌ Acento en texto corrido (solo en palabras sueltas que lo ameriten).

### 11.7 Datos vivos: sparklines y barras de progreso

Algunos elementos del sistema muestran datos que cambian en tiempo real (CPU, RAM, temperatura, tráfico de red, nivel de batería, progreso de audio). Estos elementos tienen su propio lenguaje:

**Sparklines (líneas de histórico):**
- Línea continua de 1 px de grosor, color `accent` (hielo glaciar).
- Sin relleno debajo: solo el trazo.
- Curva suave (interpolación, no segmentos rectos).
- Longitud: 6–10 muestras visibles. No más (se vuelve ilegible), no menos (se vuelve trivial).
- Sin ejes, sin etiquetas numéricas, sin marcas de tiempo. La sparkline *sugiere* tendencia, no comunica precisión.
- Posición: a la derecha del valor numérico que acompaña (alineadas en baseline).

**Barras de progreso:**
- Altura: 4–6 px. Más gruesas se sienten como controles de volumen; más finas se pierden.
- Color de relleno: `accent` (hielo glaciar) para progreso neutro, `warning` si está en zona de atención, `error` si está en zona crítica.
- Color de fondo (track): `surface-alt` o `border` desaturado.
- Sin texto encima. La barra habla sola. Si hace falta porcentaje, va al lado, no encima.
- Sin animación de relleno: la barra se actualiza al valor, no se "llena" con transición.

**Lo que está prohibido:**
- ❌ Ondas de audio estilo Spotify/Winamp (visualización orgánica, no geométrica).
- ❌ Spinners circulares dentro de un módulo de datos (los datos no giran, se miden).
- ❌ Números con demasiados decimales (no "12.473%", sí "12%").
- ❌ Dos sparklines apiladas en la misma zona (se confunden).
- ❌ Animación de la sparkline en tiempo real (se vuelve ruidosa; debe "saltar" entre muestras).

**Cuándo usar sparkline vs barra:**
- Sparkline: cuando el histórico es el dato (CPU, RAM, NET — lo que importa es la tendencia).
- Barra: cuando el valor actual es el dato (batería, progreso de audio — lo que importa es "cuánto falta").

---

## 12. Tratamiento del wallpaper

### 12.1 Integración wallpaper ↔ UI

- **Wallpaper dominante + UI contenida:** la regla del 80/20. El wallpaper ocupa peso visual; la UI ocupa peso funcional.
- **Paneles translúcidos con tinte cálido:** la madera que flota sobre el agua.
- **Sin marco de ventana sobre el wallpaper:** las ventanas no compiten con el fondo. Su fondo es la cubierta, no la pared.

### 12.2 Peso visual del wallpaper

- **Por defecto:** el wallpaper es protagonista. Tiene peso, tiene drama, tiene escala.
- **Cuando hay alerta:** la alerta toma precedencia local sin ocultar el wallpaper.
- **Cuando hay video o contenido fullscreen:** el wallpaper se reemplaza por el contenido, pero el "marco" del sistema (barra, dock) se atenúa, no desaparece.

### 12.3 ¿Todos los wallpapers deben ser dramáticos?

No. La UI debe sobrevivir un wallpaper minimalista, abstracto o incluso liso. Pero el lenguaje visual está calibrado para que el wallpaper **pueda** ser dramático.

**Regla de los dos extremos:**

- **Wallpaper dramático (drakkar, fiordo, tormenta):** la UI se contiene más, porque el wallpaper ya habla.
- **Wallpaper minimalista:** la UI puede permitirse un poco más de presencia (sin pasarse), porque el wallpaper es mudo.

**Nunca:** wallpaper genérico corporativo (gradiente azul, foto de paisaje random) — rompe el contrato sin aportar.

### 12.4 Familias de wallpaper aceptables

| Familia | Cuándo |
|---|---|
| **Paisaje nórdico** (fiordos, montañas, costas brumosas) | Default. La metáfora raíz. |
| **Naturaleza muerta ritual** (objetos vikingos tallados, armas, herramientas sobre madera) | Variante íntima. Para workstations de trabajo profundo. |
| **Abstracto geométrico austero** (tramado de triángulos, líneas entrelazadas, nudos) | Variante utilitaria. Para días de alta concentración. |
| **Minimalista textural** (texturas de piedra, madera, acero casi a pantalla completa) | Variante de respeto. Cuando el wallpaper debe ceder toda la palabra. |

**Nunca:** wallpaper anime, wallpaper de paisaje tropical, wallpaper de ciudad nocturna, wallpaper abstracto multicolor.

---

## 13. Ornamentación

### 13.1 Escala de solemnidad

NordicOS tiene una **escala explícita de solemnidad**. Cada superficie tiene un rango permitido:

| Nivel | Zonas | Ornamentación permitida |
|---|---|---|
| **0 — Utilitaria pura** | Áreas de trabajo dentro de apps (terminal, código, archivos) | Cero. Solo lo funcional. |
| **1 — Estándar** | Barra superior, dock, menús contextuales, tooltips | Motivo geométrico mínimo como acento (un trazo, un punto). Nunca figurativo. |
| **2 — Elevada** | Notificaciones importantes, módulos destacados (música, calendario) | Un glifo específico permitido (símbolo musical, marca de evento). |
| **3 — Ceremonial** | Launcher, splash screen, login, hyprlock, primer arranque | Ornamentación plena: marco de 2 px, glifo runico, jerarquía tipográfica marcada, motivo decorativo en cabecera. |

**Regla de oro:** subir de nivel está permitido cuando se gana la solemnidad; bajar es humillar el lenguaje.

### 13.2 Launcher vs. barra superior

La diferencia entre el launcher (ceremonial) y la barra superior (estándar) es la diferencia entre el mascarón de proa y los remos. **No** deben parecerse en peso visual, aunque compartan paleta.

| Aspecto | Barra superior | Launcher |
|---|---|---|
| Marco | 1 px sutil | 2 px + ornamentación lateral opcional |
| Tipografía | Sans compacto | Sans compacto + glifo runico en cabecera |
| Glifos | Line, uniformes | Permiten glifos ceremoniales en sección destacada |
| Densidad | Alta (muchos módulos pequeños) | Media-baja (pocas opciones, mucho aire) |
| Padding interno | Contenido | Generoso |

### 13.3 ¿Cuándo se permite ornamentar?

- **Solo** en zonas ceremoniales (nivel 3).
- **Nunca** en zonas utilitarias (nivel 0).
- **Con cuidado** en zonas estándar y elevada: una marca, no un despliegue.

**Test:** si quitas el ornamento y la zona sigue comunicando lo mismo, el ornamento era decorativo y sobra. Si quitándolo la zona pierde solemnidad, era estructural y se queda.

---

## 14. Patrones repetitivos / motivos

### 14.1 Motivos admitidos

| Motivo | Frecuencia de uso | Zona |
|---|---|---|
| **Runas Elder Futhark** (ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ) | Esporádica | Launcher (runa por letra), splash, login, hyprlock |
| **Triángulos entrelazados (Valknut)** | Esporádica | Splash, login, marca de "ready", notificaciones de cierre |
| **Knotwork / entrelazado** | Muy rara | Splash de fondo, wallpaper abstracto |
| **Cuervos** | Solo wallpaper | Paisaje, naturaleza muerta |
| **Lobos** | Solo wallpaper | Paisaje, naturaleza muerta |
| **Dragones (longship prows)** | Solo wallpaper | Paisaje |
| **Espirales** | Decorativa mínima | Detalles del launcher (esquina, marca de agua) |

### 14.2 Cuántos motivos admite el lenguaje

**Uno bien ejecutado, no varios combinados.** Valknut o runa, no Valknut + runa + dragón en la misma superficie. La contención es lo que da solemnidad.

Si una superficie ya tiene un motivo runico en cabecera, no debe tener un Valknut en el pie. Si un wallpaper tiene un drakkar, los paneles no necesitan otro símbolo náutico.

### 14.3 Cuándo aparece un motivo

- **Valknut:** asociado a lo cíclico, lo cerrado, lo completo. Splash de cierre, "listo", "todo en orden".
- **Runas:** asociadas a lo individual, lo específico. Cada runa tiene un significado — úsala con intención, no como decoración genérica.
- **Motivos animales (cuervo, lobo):** solo wallpaper. No se meten en la UI.

### 14.4 Anatomía de los motivos ceremoniales

**Valknut (los tres triángulos entrelazados):**
- **Forma mínima:** tres triángulos equiláteros, dos hacia abajo y uno hacia arriba, entrelazados.
- **Variación aceptada:** triángulos con punta truncada o bordes ligeramente curvados, siempre que la lectura "tres triángulos entrelazados" se mantenga.
- **Tamaño mínimo:** 16 px de alto. Por debajo de eso, se pierde la lectura y se vuelve ruido.
- **Tamaño máximo:** 240 px de alto. Por encima, compite con el wallpaper en lugar de dialogar.
- **Color:** siempre en accent o text. Nunca en estados (no es success ni error).
- **Posición:** centrado, esquina superior, o como marca al pie. Nunca repetido en una misma superficie.

**Runas Elder Futhark:**
- **Fuente:** tallada, no escrita. Trazos rectos, ángulos marcados, sin florituras.
- **Tamaño mínimo:** 20 px. Las runas pequeñas son ilegibles y se confunden con glifos abstractos.
- **Tamaño máximo:** 80 px en UI normal; 200 px en splash/login.
- **Uso permitido:** una runa por superficie ceremonial, máximo. Si hay varias, deben ser adyacentes sin estridencia (ej. una fila de tres runas en el pie del launcher).
- **Color:** en accent o text. Rara vez en otros roles.
- **Runa por letra:** si se usa runa como letra inicial de un comando (ej. ᚠ para "file"), debe ser la misma runa siempre, no rotada.

**Espirales:**
- **Forma:** dos a cuatro vueltas concéntricas, sin inicio ni fin visible.
- **Variación:** permitido añadir un punto central (representa el ojo de Odín), pero no obligatorio.
- **Tamaño:** mínimo 24 px, máximo 80 px.
- **Uso:** estrictamente decorativo. Aparece en launcher, splash, login. Nunca en estado de error (la espiral se asocia a quietud, no a urgencia).
- **Posición:** siempre como detalle de marco o esquina, no como contenido central.

**Knotwork (entrelazado):**
- **Forma:** dos o tres cuerdas entrelazadas sin cruces aparentes (estilo Urnes o Borre).
- **Uso:** muy raro. Solo en splash screens de eventos importantes (primer arranque, actualización mayor) o como detalle de borde en hyprlock.
- **Tamaño:** debe ser grande (mínimo 120 px) para que la lectura del entrelazado funcione.
- **Color:** accent sobre bg puro. Nunca sobre surface (se diluye).

---

### 14.5 Significado narrativo de las runas (referencia)

Si un componente ceremonial quiere usar una runa con intención, esta es la guía mínima. No es una tabla cerrada — el equipo puede añadir matices — pero es la convención del proyecto.

| Runa | Nombre | Significado | Uso sugerido |
|---|---|---|---|
| ᚠ | Fehu | Ganado, abundancia | Splash de primer arranque (bienvenida) |
| ᚢ | Uruz | Fuerza, vitalidad | Estado "todo en orden" |
| ᚦ | Thurisaz | Gigante, espina, protección | Indicador de seguridad / privacidad |
| ᚨ | Ansuz | Dios, mensaje, comunicación | Input de texto / chat |
| ᚱ | Raidho | Viaje, camino | Splash de login |
| ᚲ | Kenaz | Antorcha, conocimiento | Modo lectura / foco |
| ᚷ | Gebo | Regalo, intercambio | Acción de compartir |
| ᚹ | Wunjo | Alegría, armonía | Confirmación positiva |
| ᚺ | Hagalaz | Granizo, disrupción | Alerta no urgente (recordatorio) |
| ᚾ | Nauthiz | Necesidad, restricción | Estado de batería baja |
| ᛁ | Isa | Hielo, quietud | Estado de pausa / standby |
| ᛃ | Jera | Cosecha, ciclo | Indicador de progreso cíclico |
| ᛇ | Eihwaz | Tejo, resistencia | Indicador de carga |
| ᛈ | Perthro | Destino, azar | Generador aleatorio |
| ᛉ | Algiz | Protección, defensa | Estado seguro / cifrado |
| ᛊ | Sowilo | Sol, victoria | Confirmación de tarea completada |
| ᛏ | Tiwaz | Tyr, victoria honorable | Acción destructiva confirmada |
| ᛒ | Berkana | Abedul, renacimiento | Crear nuevo |
| ᛖ | Ehwaz | Caballo, movimiento | Acción de sincronización |
| ᛗ | Mannaz | Humano, humanidad | Perfil de usuario |
| ᛚ | Laguz | Agua, flujo | Streaming / red activa |
| ᛜ | Ingwaz | Fertilidad, potencial | Estado de carga completa |
| ᛞ | Dagaz | Día, despertar | Cambio de modo |
| ᛟ | Othala | Herencia, hogar | Directorio home |

**Advertencia:** usar runas sin intención es peor que no usarlas. Si un componente quiere una marca ceremonial pero no tiene claro el significado, mejor que use el Valknut o un detalle geométrico neutro. La falta de intención se nota.

---

## 15. Voz del sistema (copy y mensajes)

NordicOS habla. No mucho, pero cuando habla, dice lo que tiene que decir con el tono correcto.

### 15.1 Tono general

- **Directo:** sin rodeos. "Archivo no encontrado" en lugar de "Lo sentimos, no pudimos localizar el archivo que solicitaste".
- **Sobrio:** sin exclamaciones. "Conectado" en lugar de "¡Listo!".
- **Impersonal pero cálido:** "El paquete se instaló" en lugar de "He instalado el paquete" o "Tu paquete fue instalado".
- **Nunca apologético en exceso:** "No se pudo conectar" en lugar de "Lo sentimos mucho, hubo un problema al intentar establecer la conexión".

### 15.2 Tratamiento de errores

- **Una línea:** el error se dice en una línea. Si necesita más, va en tooltip o detail expandible.
- **Causa + acción:** "Archivo no encontrado. Verifica la ruta."
- **Nunca insultar al usuario:** "Operación cancelada" en lugar de "¿Por qué cancelaste?".
- **Nunca echar la culpa al sistema:** "No se pudo completar la escritura" en lugar de "El sistema falló al escribir".

### 15.3 Tratamiento de confirmaciones

- **Solo para acciones destructivas irreversibles:** borrar archivo importante, formatear disco, cerrar sesión con cambios sin guardar.
- **Voz:** "Confirmar borrado de '...'". Sin "¿Estás seguro?". El usuario ya sabe lo que está haciendo.
- **Botones:** "Confirmar" / "Cancelar". Sin "Sí, bórralo" ni "No, no lo borres".
- **Plazo:** la confirmación vive 10 s sin respuesta, después se cierra sola. No espera eternamente.

### 15.4 Tratamiento de éxito

- **Discreto:** "Guardado". No "¡Tu archivo ha sido guardado con éxito!".
- **Inferido cuando es posible:** a veces no hace falta decir nada. Si la operación fue exitosa y el resultado es visible (archivo aparece en lista), no se añade mensaje.
- **Solemne solo en ceremoniales:** splash de primer arranque, hyprlock tras autenticación, pueden usar copy ceremonial. El resto, no.

### 15.5 Tratamiento de notificaciones pasivas

- **Cero copy cuando sea posible:** un cambio de volumen no necesita texto. El icono del volumen y la barra visual bastan.
- **Una palabra cuando sea necesario:** "Copiado", "Pegado", "Conectado", "Desconectado".
- **Glifo en lugar de palabra cuando sea posible:** el estado de batería puede ser solo el icono del nivel, sin el porcentaje encima (opcional para el usuario).

### 15.6 Copy ceremonial (solo en zonas rituales)

Aquí sí se permite un poco más de peso:

- **Splash de primer arranque:** "Embarcando." (Una palabra, verbo en presente, sin sujeto.)
- **Splash de actualización mayor:** "La nave ha sido revisada."
- **Hyprlock al desbloquear:** "Buen viaje." (Una despedida corta.)
- **Confirmación de cierre de sesión:** "Volverás." (Sin signo de pregunta. La promesa es implícita.)

**Regla:** el copy ceremonial nunca supera dos palabras. Tres ya es literatura.

### 15.7 Lo que el sistema nunca dice

- ❌ "¡Hola!" (demasiado efusivo).
- ❌ "Lamentamos las molestias" (corporativitis).
- ❌ "Optimiza tu experiencia" (marketing de SaaS).
- ❌ "Hemos actualizado nuestra política" (legalés).
- ❌ Cualquier mención de marca comercial.
- ❌ Emoji.
- ❌ Puntos suspensivos dramáticos ("Cargando...").
- ❌ "Error 404" sin explicación humana.
- ❌ MAYÚSCULAS para dar énfasis (eso lo hace el peso o el tamaño, no la ortografía).
- ❌ Tildes decorativas o estilizadas.

---

## 16. Estados y micro-interacciones

Cómo se comporta un elemento interactivo cuando el usuario lo toca, lo mira o lo abandona.

### 16.1 Estados canónicos

Cada elemento interactivo del sistema vive en alguno de estos estados:

| Estado | Qué cambia | Qué no cambia |
|---|---|---|
| **Default (reposo)** | — | — |
| **Hover** | Tinte de surface-alt + hairline de acento-soft a la izquierda (en listas) o al fondo (en botones) | Tamaño, posición, color de texto |
| **Active / pressed** | Acento-soft más saturado, slight inset (1 px) | Tipografía, glifos |
| **Focus (teclado)** | Acento principal como outline (2 px) — la única manera en que algo "se ilumina" | Background, dimensiones |
| **Selected** | Hairline de acento a la izquierda + texto en text (no muted) | Layout general |
| **Disabled** | Texto en text-muted al 50% de opacity, sin pointer | Forma y posición (sigue ocupando espacio) |
| **Loading** | Glifo que pulsa con ciclo de 2 s (no spinner) | Estructura general del elemento |

### 16.2 Micro-interacciones permitidas

- **Cambio de tinte:** un hover o active puede cambiar el tinte del fondo en un parpadeo de 100 ms. Es sutil, no se nota como animación; se nota como respuesta.
- **Cambio de icono:** el icono de un toggle puede cambiar entre dos estados (wifi on / wifi off), no es rotación.
- **Aparición de un detalle:** un tooltip aparece en 200 ms desde el lado del cursor (no desde abajo).
- **Subrayado en hover:** permitido solo en texto (links, items navegables). El subrayado aparece con fade, no con scale.

### 16.3 Micro-interacciones prohibidas

- ❌ Scale en hover (los elementos no crecen al mirarlos).
- ❌ Color shift animado de un color a otro muy distinto (el cambio es siempre entre dos tonos del mismo rol).
- ❌ Sombras que se desplazan al hacer hover (la sombra es funcional, no animada).
- ❌ Ripple effect (asociado a Material Design).
- ❌ Botones que se "hunden" más de 1 px al presionarlos (asociado a skeuomorfismo táctil).

### 16.4 El estado de focus como acto de hospitalidad

En NordicOS, el focus de teclado es un gesto de cortesía: el sistema le dice al usuario "sé que estás aquí". Por eso:

- **Siempre visible:** no se oculta el outline en focus "porque ya hay hover". El usuario que navega con teclado necesita la marca.
- **Estilo:** outline de 2 px en acento, separado 2 px del elemento (no pegado).
- **Nunca con cambio de fondo:** el focus no es un hover, no debe confundirse.
- **Para elementos pequeños:** el outline envuelve al elemento + 4 px de margen.

### 16.5 El estado de loading como acto de honestidad

Cuando el sistema está haciendo algo que toma tiempo, debe decirlo. Pero con dignidad:

- **No más de 3 s sin feedback:** si una operación toma más de 3 s, debe haber un indicador visible.
- **Indicador discreto:** un glifo que pulsa (no un spinner giratorio). El pulso dice "estoy trabajando"; el giro dice "estoy entreteniéndote".
- **Texto acompañante solo si la operación es confusa:** "Instalando paquetes" sí; "Copiando" no (el icono de copia ya lo dice).

---

---

## 17. Equilibrio función / decoración

### 17.1 Cuándo un módulo puede ser decorativo

- Cuando **es** la zona ceremonial (launcher, splash, login).
- Cuando es un **estado** que el usuario busca emocionalmente (la pieza de música, el módulo de calendario cuando tiene un evento importante).
- Cuando un **detalle no solicitado** recompensa la atención (un glifo runico discreto en una esquina del launcher, una textura apenas perceptible en un panel).

### 17.2 Cuándo un módulo debe ser austero

- **Siempre** que sirva para operar el sistema: workspaces, hora, batería, redes.
- **Siempre** en terminal y código.
- **Siempre** en herramientas pasivas (relación de archivos, búsqueda).

### 17.3 La barra superior como caso de estudio

La barra superior de NordicOS es **densa en información pero contenida en presencia**. Esto es deliberado:

- **Densa en información:** porque el navegante necesita saber mucho con una mirada. Hora, energía, conectividad, ventanas abiertas, audio.
- **Contenida en presencia:** porque esos datos son instrumentos, no decoración. No pueden pelear con la proa (música) ni con el ancla (dock).

**Principio detrás:** un instrumento de cubierta está hecho para ser leído de un vistazo, no para ser contemplado. Si tiene ornamento, distrae de su función. Si tiene dignidad visual (tipografía consistente, alineación disciplinada, separación por aire), cumple su función con belleza.

---

## 18. Anti-patrones (lo que NUNCA se hace)

Lista explícita. Cualquiera de estos rompe el contrato.

### 18.1 Gradientes chillones
- ❌ Gradientes multicolor de los 2000 (azul → verde → rojo).
- ❌ Gradientes saturados sobre paneles translúcidos.
- ❌ Gradientes que sustituyen la jerarquía.
- ✅ Permitido: un único gradiente sutil entre dos tonos muy cercanos del acento, si aporta profundidad al módulo de audio.

### 18.2 Ornamentación sin oficio
- ❌ Bordes biselados tipo Windows 98.
- ❌ Drop shadows exageradas de los 2010.
- ❌ Skeuomorfismo fingido (cuero falso, madera falsa).
- ❌ Iconos emoji decorativos al lado de iconos line.

### 18.3 Glassmorphism genérico
- ❌ Transparencias turquesa estilo macOS Big Sur genérico.
- ❌ Blur agresivo que parece vidrio esmerilado.
- ❌ Capas translúcidas apiladas que tapan el fondo en vez de revelarlo.
- ✅ Permitido: translucidez filtrada con tinte cálido de la madera, blur mínimo, luminancia controlada.

### 18.4 Neón saturado
- ❌ Acentos cyan eléctrico sobre fondos claros.
- ❌ Efectos de "glow" alrededor de texto o iconos.
- ❌ Borders luminosos en hover.
- ✅ El acento es luminoso, pero como mineral, no como bombilla.

### 18.5 Material You automático
- ❌ Dejar que el wallpaper genere la paleta. El wallpaper **dialoga** con la paleta; no la dicta.
- ❌ Tonos cálidos cuando el wallpaper es cálido, tonos fríos cuando es frío. La paleta tiene identidad propia.
- ✅ La paleta manda. El wallpaper entra en diálogo, no en vasallaje.

### 18.6 Iconografía inconsistente
- ❌ Mezclar cinco estilos (line + fill + duotone + emoji + custom).
- ❌ Iconos del mismo concepto con grosores distintos.
- ❌ Iconos de proveedores distintos (Material + Fluent + Papirus + custom) en la misma superficie.
- ✅ Un solo grosor, un solo estilo. Excepción: zona ceremonial con glifos runicos específicos.

### 18.7 Tipografías que pelean con la legibilidad
- ❌ Display fonts en texto corrido.
- ❌ Tipografías con muchos ornamentos en labels de estado.
- ❌ Más de tres familias tipográficas en una superficie.
- ❌ Tamaños arbitrarios que rompen la escala 0.85 / 1.0 / 1.4–1.8.
- ❌ Texto italic para enfatizar (usar peso o color, no slant).
- ✅ Sans compacto + monospace + display ceremonial, cada uno en su rol.

### 18.8 Composición descuidada
- ❌ Módulos sin alineación con la cuadrícula.
- ❌ Padding arbitrario que rompe el ritmo.
- ❌ Texto centrado sin razón (todo justificado a la izquierda por defecto).
- ❌ Más de tres módulos compitiendo por el centro visual.

### 18.9 Lo que rompe el lenguaje nórdico específicamente
- ❌ Cualquiềr referencia explícita a otras mitologías (griega, egipcia, azteca) si va más allá de un guiño cultural.
- ❌ Calidez hogareña tipo "cabaña acogedora" — NordicOS es la cubierta, no la sala común.
- ❌ Uso del rojo vibrante — el rojo de NordicOS es sangre seca, no rubí.
- ❌ Iconografía con escudos, cruces o símbolos cristianos — no es la cosmología del proyecto.
- ❌ Cómic, caricatura o chibi en ilustraciones — el tono es solemne.
- ❌ Tonos pastel suaves — el sistema es frío, no dulce.

---

## 19. Reglas de extensión

Si un componente nuevo llega al proyecto, debe pasar este checklist antes de declararse "del idioma".

### 19.1 Checklist obligatorio

1. **¿Identifica su nivel de solemnidad (0–3)?** Si no sabe en qué nivel está, no está listo.
2. **¿Usa los roles cromáticos correctos?** ¿El panel es surface? ¿El texto es text? ¿El acento es accent? Si mezcla roles, hay que rehacerlo.
3. **¿Respeta la escala tipográfica (0.85 / 1.0 / 1.4–1.8)?** Si introduce un cuarto tamaño, hay razón para ello o hay que eliminarlo.
4. **¿Mantiene el grosor de borde correcto para su nivel?** (1 px en estándar, 2 px en ceremonial).
5. **¿Respeta la alineación de la cuadrícula?** Si un padding es 13 px "porque se ve mejor", es 12 o 16.
6. **¿El icono (si tiene) es del mismo estilo y grosor que los demás?** Si mezcla estilos, se cambia el icono, no la regla.
7. **¿Está dentro de un panel que filtra el wallpaper, no que lo tapa?** Si compite con el fondo, se reduce opacidad.
8. **¿Sostiene la metáfora?** ¿Podría explicarse como un instrumento de cubierta sin que suene forzado?
9. **¿Introduce algún anti-patrón de la sección 16?** Si sí, se rehace o se descarta.
10. **¿El ornamento (si lo tiene) pasa el test de la sección 13.3?** Si quitándolo no se pierde nada, sobra.

### 19.2 Test rápido de aprobación

Un diseñador externo debería poder mirar el componente y decir: *"esto es NordicOS"*, sin necesidad de leer documentación. Si necesita contexto para saber si encaja, no encaja.

### 19.3 Test del walkaround

Un usuario que ve el componente nuevo al lado del wallpaper durante 30 segundos:
- ¿Siente continuidad con el resto del sistema, o siente que "algo nuevo apareció"?
- Si siente continuidad, aprobado.
- Si siente "algo nuevo", hay que revisar ornamentación, color o tipografía.

---

## 20. Ejemplos canónicos

Elementos de la referencia que cualquier componente nuevo debería aspirar a emular.

### 20.1 El módulo de música en la barra superior

**Por qué es canónico:** el centro de gravedad del sistema. Logra ser denso (texto, título, controles, progreso) sin saturar. Lo logra con jerarquía tipográfica disciplinada, padding generoso, e iconografía de glifos musicales que pertenecen al sistema sin pedir más protagonismo que el justo.

**Qué emular de él:**
- Tipografía con tres tamaños claros (título, artista, progreso).
- Iconos del mismo grosor en controles (play, pausa, next).
- Acento reservado para estado activo (la canción sonando).
- Fondo de panel continuo con el resto, sin marco extra.

### 20.2 El launcher ceremonial

**Por qué es canónico:** la única zona donde el marco tiene permiso de hablar. Logra solemnidad sin cacofonía porque el ornamento está jerarquizado: glifo runico en cabecera, marco de 2 px, focus indicator vertical de hielo, padding generoso. No compite con el wallpaper porque el wallpaper se ve detrás filtrado.

**Qué emular de él:**
- Cabecera con identidad propia (glifo ceremonial).
- Marco de 2 px con propósito, no decorativo.
- Jerarquía clara: input, lista, footer.
- Tinte cálido sobre el wallpaper, no blanco clínico.

### 20.3 El módulo de workspaces a la izquierda

**Por qué es canónico:** lo opuesto al launcher. Sin marco, sin ornamento, sin presencia. Un pequeño indicador de dónde está el navegante. Solo tipografía y color, contenidísimo.

**Qué emular de él:**
- Sin marco propio cuando no hace falta.
- Tinte de acento solo en el workspace activo.
- Padding mínimo pero no nulo (respira, no ahoga).
- Agrupado a la izquierda como un ancla solitaria.

### 20.4 Los módulos de estado a la derecha

**Por qué es canónico:** un racimo de datos (red, batería, hora) que juntos cuentan "el barco está en buen estado". Lo logran con proximidad (los módulos casi se tocan, separados por aire, no por líneas) y con consistencia visual (mismos tamaños, mismos colores, misma tipografía).

**Qué emular de él:**
- Datos secundarios agrupados, no dispersos.
- Separación por aire, no por bordes.
- Íconos del mismo tamaño y grosor.
- Tooltip con información ampliada cuando hace falta.

### 20.5 El wallpaper dramático

**Por qué es canónico:** establece el mundo. Sin él, NordicOS sería solo un tema oscuro bonito. Con él, es un lugar. La escala (drakkar pequeño, fiordo inmenso, cordillera a lo lejos) le da proporción a todo lo demás: la UI es un instrumento en un paisaje, no el centro de la habitación.

**Qué emular de él:**
- Siempre establecer escala.
- Siempre permitir que la UI dialogue con un fondo con peso.
- Nunca sustituir el wallpaper por algo plano "porque distraía".
- Mantener un horizonte coherente.

### 20.6 El widget de calendario (contraste tipográfico ceremonial)

**Por qué es canónico:** es el ejemplo más claro del patrón "label pequeño / número ceremonial / label pequeño" (§9.6). Logra solemnidad sin cacofonía porque el dato aislado manda y el contexto lo enmarca, no compite con él.

**Qué emular de él:**
- Label superior (día de la semana) en uppercase, pequeño (12 px), color `text-muted` o `accent-soft`.
- Número central (día del mes) en sans compacto o display, enorme (48–72 px), peso medium, color `text` principal.
- Label inferior (mes y año) en uppercase, pequeño-mediano (13–14 px), color `text-muted`.
- Glifo ceremonial al inicio y al final (runa ᚱ Raidho o Valknut pequeño) enmarcando el número. Un motivo, dos apariciones — discreto.
- Sin marcas de grid, sin eventos del día, sin navegación. El calendario ceremonial muestra *un* dato, no la agenda.

**Por qué este patrón no se extrapola al waybar:**
- El waybar necesita densidad y ritmo visual; el contraste extremo rompería el flujo.
- El calendario es una superficie contemplativa (se mira cuando el navegante quiere saber la fecha, no cada segundo). El waybar es informativo en tiempo real.

---

## 21. Reglas derivadas para superficies nuevas

> Estas son las reglas que el documento debe sobrevivir si mañana hay que diseñar un menú contextual, un dock, un panel lateral, un widget de notificaciones, una app GTK, una splash screen, una animación de login.

### 21.1 Menú contextual

- **Solemnidad:** nivel 1 (estándar).
- **Material:** surface con hairline 1 px de border.
- **Tipografía:** sans compacto, un solo tamaño base, items separados por aire.
- **Acento:** reservado para la opción por defecto o la marcada como "recomendada".
- **Ornamento:** ninguno. Solo un pequeño glifo opcional si la acción tiene un atajo runico (ejecutar, copiar).
- **Hover:** surface-alt con hairline de acento-soft a la izquierda (no fondo entero).

### 21.2 Panel lateral

- **Solemnidad:** nivel 1–2 según contenido.
- **Material:** surface continuo (no translúcido) para no competir con el wallpaper en una zona grande.
- **Bordes:** solo el del lado que da al contenido principal.
- **Tipografía:** jerarquía de tres niveles, con el más grande reservado para cabeceras de sección.
- **Ornamento:** una marca pequeña por sección (puede ser un glifo de los tres alfabetos visuales según el contenido).

### 21.3 Widget de notificaciones

- **Solemnidad:** nivel 2 (elevada).
- **Material:** surface translúcido con tinte de madera.
- **Bordes:** 1 px de border + línea de acento lateral cuando la notificación es del tipo "urgente".
- **Icono:** del alfabeto de glifos del sistema, 16–18 px, en color de categoría.
- **Tipografía:** título con peso medium, mensaje con peso regular, timestamp con text-muted.
- **Sonoridad:** si el sistema tiene sonidos, deben ser de instrumentos acústicos, no de tonos digitales.

### 21.4 App GTK externa (ej. navegador, gestor de archivos)

- **Solemnidad:** nivel 1.
- **Alineación:** heredar tipografía sans compacta del sistema.
- **Colores:** respetar roles semánticos (bg, surface, text, accent).
- **Ornamento:** ninguno dentro del contenido. La chrome (header, sidebar) puede tener hairline sutil.
- **Test:** ¿se siente como una herramienta del barco o como una app forastera? Si es forastera, hay que revisar cómo se está aplicando el tema.

### 21.5 Splash screen / animación de login

- **Solemnidad:** nivel 3 (ceremonial).
- **Composición:** fondo wallpaper con tinte (más oscuro que el wallpaper normal, para que el logo/marca adelante tenga peso).
- **Marca:** glifo Valknut o runa ᚱ (raidho, "viaje") centrado, tamaño ceremonial.
- **Tipografía:** display ceremonial, una sola línea de texto, peso medium.
- **Animación:** una sola transición de entrada (aparición), una sola de salida (desaparición). Sin "loading spinners" genéricos — si hace falta indicador, es un glifo que se ilumina, no un arco que gira.

### 21.6 Hyprlock (pantalla de bloqueo)

- **Solemnidad:** nivel 3.
- **Composición:** wallpaper muy oscurecido (niebla cerrada) + marco ceremonial de 2 px + input centrado.
- **Tipografía:** input en display ceremonial; hora y fecha en sans compacto.
- **Comportamiento:** el campo de password no muestra caracteres hasta que se empieza a escribir; mientras tanto, muestra un glifo de placeholder (Valknut tenue).
- **Ornamento:** permitido. Aquí el sistema entero está en pausa ceremonial.

### 21.7 Widget de audio (expansión futura)

- **Solemnidad:** nivel 2.
- **Material:** surface estándar, sin ornamento, pero con un glifo musical más grande como marca.
- **Tipografía:** título del tema (sans compacto, peso medium), artista (sans compacto, regular), álbum (text-muted).
- **Acento:** reservado para "está sonando".
- **Visualización:** si la hay, debe ser geometría austera (línea, anillo, barra) — no onda estilo Spotify.

### 21.8 Animación de primer arranque

- **Solemnidad:** nivel 3.
- **Composición:** pantalla negra (bg puro), glifo Valknut que aparece con un fade largo (no un zoom in de marketing), luego se disuelve, luego aparece el escritorio.
- **Tipografía:** ninguna. La animación no necesita texto.
- **Tiempo total:** mínimo 1.5 s, máximo 3 s. No más. La solemnidad necesita tiempo, pero no paciencia.

### 21.9 Screensaver / protector de pantalla

- **Solemnidad:** nivel 2–3 según contenido.
- **Composición:** wallpaper muy oscurecido (niebla cerrada) con glifo Valknut o espiral moviéndose lentamente.
- **Movimiento:** lento, casi imperceptible. Una rotación completa del glifo no debe tomar menos de 60 s.
- **Salida:** fundido al login, no corte abrupto.
- **Tipografía:** ninguna. La pantalla de espera no necesita texto.

### 21.10 Notificación crítica a pantalla completa

- **Solemnidad:** nivel 3 (el sistema se detiene).
- **Composición:** wallpaper al 40% de luminancia, marco ceremonial de 2 px, glifo Valknut grande centrado, mensaje breve debajo.
- **Tipografía:** display ceremonial para el título, sans compacto para el cuerpo.
- **Comportamiento:** el usuario debe poder confirmar con una sola tecla o click. Sin "¿está seguro?" — la solemnidad no pregunta dos veces.

### 21.11 Terminal embebida en otra app (ej. terminal de VSCode)

- **Solemnidad:** nivel 0 (utilitaria pura).
- **Material:** bg directo, sin surface (la app anfitriona ya provee el contexto).
- **Tipografía:** monospace técnica, tamaño según preferencia del usuario.
- **Colores:** roles semánticos del sistema. La terminal embebida hereda el lenguaje sin añadir capas.
- **Ornamento:** cero. Aquí se trabaja, no se contempla.

### 21.12 Notificación tipo toast (recordatorio sutil)

- **Solemnidad:** nivel 1.
- **Composición:** surface con tinte cálido, 1 px border, icono del alfabeto de sistema, texto breve, sin botón (desaparece sola).
- **Duración:** 4–6 s. Ni más (irrita) ni menos (no se lee).
- **Posición:** parte inferior de la pantalla, donde no compite con el dock.
- **Animación:** aparece con fade corto (200 ms), desaparece con fade más largo (400 ms). La asimetría de tiempos es deliberada: la entrada es segura, la salida es gentil.

### 21.13 Calendar widget / agenda

- **Solemnidad:** nivel 2.
- **Composición:** surface estándar, jerarquía clara entre "hoy" (acento de hielo) y otros días (text-muted).
- **Tipografía:** sans compacto para números, tamaño medio; texto muted para nombres de días.
- **Detalle ceremonial:** un glifo de calendario (símbolo solar estilizado, no emoji) en la cabecera, una vez por superficie.
- **Eventos:** marcados con acento-soft (no saturado), no con verde o rojo. La agenda no celebra ni alarma: muestra.

### 21.14 File picker / selector de archivos

- **Solemnidad:** nivel 1.
- **Composición:** surface con sidebar (1 px border) y área principal. La sidebar muestra el árbol de directorios; el área principal muestra el contenido del directorio actual.
- **Iconos:** del alfabeto de sistema, mismos que la barra superior.
- **Selección:** hairline de acento a la izquierda del item seleccionado (como el launcher), nunca fondo entero.
- **Tipografía:** sans compacto para nombres de archivo, monospace técnico para tamaños y fechas.

### 21.15 Ventana de "acerca de" / about

- **Solemnidad:** nivel 3.
- **Composición:** wallpaper visible filtrado, marco ceremonial de 2 px, glifo Valknut o runa específica centrada, nombre del proyecto en display ceremonial, versión debajo en sans compacto muted.
- **Tipografía:** tres niveles: ceremonial para nombre, compacto para metadata, muted para créditos.
- **Comportamiento:** ninguna animación de entrada. Aparece, está, se cierra. Sin "wow effect" — la solemnidad no se exhibe.

### 21.16 Login screen (interactivo)

- **Solemnidad:** nivel 3.
- **Composición:** wallpaper al 80% (no totalmente oscurecido), marco ceremonial de 2 px, input centrado, glifo runico (Raidho, viaje) sobre el input.
- **Tipografía:** input en monospace técnica con caracteres ocultos hasta que se escribe; placeholder en display ceremonial tenue.
- **Indicador de actividad:** un glifo (punto, línea) que se ilumina con acento cuando hay actividad (tecla presionada, intento de auth). No usar spinner.
- **Error:** el marco cambia a tono de error, el input permanece. Sin shake, sin flash. La sangre seca no tiembla.

---

## 22. Movimiento y transición

NordicOS no es estático. Pero su movimiento es específico.

### 22.1 Principios del movimiento

- **Lentitud deliberada:** las transiciones en NordicOS duran más que en sistemas convencionales. Un fade de entrada típico es 250–400 ms, no 150. La calma exige tiempo.
- **Asimetría de entrada/salida:** la entrada suele ser más rápida que la salida. El sistema se ofrece, no se impone.
- **Curvas:** nada de "elastic out" ni "bounce". Solo `ease-out` o `ease-in-out`. Las animaciones de NordicOS no rebotan.
- **Ejes:** los elementos entran/salen en el eje en que fueron invitados. Si un módulo aparece desde la barra superior, baja; si aparece desde el dock, sube. Si es un panel lateral, entra desde su lado.
- **Distancia:** el elemento aparece desde cerca, no desde lejos. No hay zoom-in cinematográfico. La transición es local.

### 22.2 Tipos de transición permitidos

| Transición | Uso | Duración | Curva |
|---|---|---|---|
| **Fade** | Aparición de overlays, notificaciones, tooltips | 200–300 ms | ease-out |
| **Slide corto** | Entrada de launcher, paneles laterales | 250–400 ms | ease-out |
| **Scale sutil** | Aparición de menús contextuales | 180–250 ms | ease-out (max 1.03x) |
| **Fade extendido** | Salida de notificaciones, hyprlock | 400–600 ms | ease-in-out |
| **Disolver** | Cambio de wallpaper, splash transitions | 800–1500 ms | linear (sin curva, sin sorpresa) |

### 22.3 Tipos de transición prohibidos

- ❌ Bounce / elastic (asociado a diseño infantil o playful).
- ❌ Zoom dramático (asociado a marketing, no a sistema operativo).
- ❌ Rotación como efecto (asociado a.loading de apps móviles).
- ❌ Parallax en UI (asociado a sitios web de marketing).
- ❌ Transiciones con varios elementos a la vez (asociado a sincronización de iconos tipo Apple).
- ❌ Fade in + fade out simultáneos en el mismo gesto (asociado a doble buffering torpe).

### 22.4 Movimiento continuo (cuando aplica)

Algunos elementos pueden tener movimiento continuo:

- **Indicador de actividad:** un glifo (punto o línea) que late con un ciclo de 2 s (1 s encendido, 1 s apagado). Indica "el sistema está haciendo algo sin reclamar tu atención".
- **Cursor del terminal:** parpadeo a 1 Hz (1 ciclo por segundo). Más rápido es nervioso, más lento es perezoso.
- **Barra de progreso de audio:** deslizamiento lineal, sin easing. La música no acelera ni frena.
- **Screensaver / protector:** rotación o pulsación muy lenta (mínimo 30 s por ciclo).

### 22.5 Movimiento prohibido

- ❌ Pulse / glow de elementos no interactivos.
- ❌ Animación de carga que aparece sin razón (los procesos del sistema no necesitan "diversión").
- ❌ Hover con scale (los hover de NordicOS cambian color o borde, no tamaño).
- ❌ Drag preview con sombra de drop elaborada (la sombra es funcional, no decorativa).
- ❌ Scroll con rubber-band (asociado a iOS, no a cubierta de drakkar).

---

## 23. Adaptación a tamaños de pantalla

NordicOS no vive solo en un monitor 16:9. Las reglas deben sostenerse en otros formatos.

### 23.1 Pantallas ultrapanorámicas (21:9 o más)

- **Barra superior:** los módulos del centro se distribuyen en una zona central acotada (no se estiran a lo largo de toda la barra). Los flancos vacíos son wallpaper a propósito.
- **Dock:** centrado, con la misma acotación central.
- **Launcher:** se mantiene en el centro, no se estira.

### 23.2 Pantallas pequeñas (laptop 13")

- **Barra superior:** la misma disposición, pero algunos módulos del racimo derecho se colapsan en tooltips hasta que se necesite verlos.
- **Dock:** número de iconos reducido. Priorizar los más usados.
- **Launcher:** se reduce en tamaño, no en solemnidad.

### 23.3 Pantallas verticales (rara vez, pero posible)

- **Barra superior:** se convierte en una columna lateral izquierda.
- **Dock:** se mantiene abajo, pero más estrecho.
- **Launcher:** centrado, formato vertical obligatorio.

### 23.4 Multi-monitor

- **Barra superior:** solo en el monitor principal. Los monitores secundarios solo tienen fondo y ventanas.
- **Dock:** solo en el principal.
- **Launcher:** aparece en el monitor donde está el cursor, no solo en el principal.
- **Wallpaper:** puede ser el mismo en todos los monitores, o uno por monitor (cada uno del mismo estilo).

### 23.5 Regla común a todos los formatos

La **jerarquía de solemnidad se preserva**. No porque la pantalla sea chica se baja el nivel del launcher. No porque la pantalla sea grande se sube el nivel de un módulo estándar. El rango de solemnidad es por rol, no por espacio disponible.

---

## 24. Glosario de términos visuales

Para que cualquier pieza del equipo hable el mismo idioma.

| Término | Significado en NordicOS |
|---|---|
| **Solemnidad** | Nivel ceremonial de una superficie (0–3). Define cuánta ornamentación, cuánto peso de marco, cuántos glifos ceremoniales admite. |
| **Rol cromático** | Lo que un color está haciendo en una composición (fondo, panel, borde, acento, texto, estado). No confundir con su nombre. |
| **Glifo ceremonial** | Símbolo con historia (runa, Valknut, espiral) que aparece solo en zonas rituales. |
| **Filtrar el wallpaper** | Mostrar el wallpaper a través de un panel con tinte sutil, no exponerlo crudo. |
| **Módulo dominante** | Pieza central de una composición (en barra superior, suele ser el módulo de audio). Define el centro de gravedad. |
| **Módulo satélite** | Pieza que orbita al dominante. No compite; acompaña. |
| **Tinte** | Baño tonal sutil que se aplica sobre wallpaper o panel para unificar atmósfera. No es gradiente. |
| **Romper el ritmo** | Introducir un detalle inesperado que recompensa la atención prolongada. Usar con cuidado. |
| **Niebla** | Translucidez atemperada que separa paneles sin gritar. |
| **Mascaron** | Pieza ceremonial más ornamentada del sistema. En NordicOS, el launcher. |
| **Cubierta** | Zona principal del escritorio. La barra superior y el dock viven aquí. |
| **Proa** | Centro de gravedad visual. Lo que mira al frente. |
| **Ancla** | Elemento que mira al pasado o fija posición (workspaces, dock). |
| **Remo** | Elemento repetido, predecible, utilitario (leds de estado, controles de audio). |
| **Cuerda / obenque** | Separador, conector. Hairline 1 px. |
| **Sello** | Marca identitaria del proyecto (Valknut) que aparece sin marco contenedor, en superficies donde la presencia narrativa pesa más que el ornamento. |
| **Sparkline** | Línea continua de 1 px en `accent` que muestra tendencia histórica de un dato (CPU, RAM, NET). No comunica precisión, sugiere dirección. |
| **Dato vivo** | Cualquier valor numérico del sistema que cambia en tiempo real (CPU%, RAM, batería, temperatura, red, audio). Tiene tratamiento visual específico (§11.7). |
| **Zona de marca** | Superficie donde conviven aplicaciones externas con identidad de marca propia (típicamente el dock). Acepta logos oficiales bajo la política §10.5. |

---

## 25. Cierre: el contrato

NordicOS no es un tema de escritorio. Es una escena.

El usuario no abre NordicOS — embarca en él. Cuando abre una terminal, no abre una herramienta: despliega una cuerda. Cuando lanza una app, no la abre: la invoca desde el mascarón.

Cada componente nuevo debe poder responder: **¿sobrevives una mañana en cubierta?**

Si sobrevive — al viento, al frío, a la quietud, al trabajo largo —, pertenece.

Si en media hora de uso el usuario siente que algo desentona, ese algo no estaba firmado por este documento. Se rehace o se va.

### 25.1 Sobre la captura canónica y su versionado

El documento está firmado contra una captura canónica que vive en `docs/references/canonical/desktop-vN.png`. Cada vez que el escritorio evoluciona (nueva paleta, nuevo wallpaper, nuevos componentes integrados), se genera una nueva versión (`desktop-v2.png`, `desktop-v3.png`, …) sin sobrescribir la anterior.

Cuando se crea una nueva captura canónica, se debe:
1. Contrastarla sección por sección contra este documento.
2. Si aparecen reglas visuales nuevas que la captura refleja y el documento no captura, **se actualiza el documento**.
3. Si el documento tiene reglas que la captura nueva contradice, hay dos caminos: o se ajusta la implementación para volver a la regla, o se reconsidera la regla (esto último requiere justificación narrativa fuerte).
4. La regla fundamental: **el documento manda sobre la implementación, no al revés.** Una desviación visual sin actualizar el documento es un bug, no una feature.

---

*Fin del documento. Cualquier adición a este lenguaje debe pasar por el checklist de la sección 19 antes de declararse parte del contrato.*