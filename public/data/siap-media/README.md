# SIAP Media — GAIA por altura.com.ec

Coloca aquí fotos y videos reales de inspectores.

Estructura sugerida:
`
siap-media/
  SIAP-01-P01-foto1.jpg
  SIAP-01-P02-video.mp4
  ...
`

Luego actualiza public/data/siap-inspections.json:
- otos: ["/data/siap-media/SIAP-01-P01-foto1.jpg"]
- ideo: "/data/siap-media/SIAP-01-P02-video.mp4"
- 	humb: "/data/siap-media/SIAP-01-P01-thumb.jpg"

Los placeholders actuales usan picsum.photos y sample-videos.com — funcionan sin necesidad de archivos locales.

Para extraer fotos de un origen (ej: carpeta compartida, Drive, cámara):
1. Copia los archivos a esta carpeta
2. Dime la ruta y los extraigo/muevo automáticamente
3. Actualizo el JSON y hago build

Tamano recomendado: 640x400 para fotos, <5MB video mp4.
