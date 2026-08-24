# Remix of SonoReport Hub

Cree una aplicación web médica sencilla, similar a un RIS, para una pequeña clínica de ultrasonido.
La clínica realiza entre 20 y 25 ecografías al día.
El sistema debe ser sencillo, rápido y optimizado para los médicos que realizan ecografías.
Características principales requeridas:
CITAS DIARIAS: Mostrar una lista de las citas de hoy, incluyendo:
Hora
Nombre del paciente
Número de teléfono
Tipo de estudio
Estado (Pendiente, En estudio, Reportado, Enviado)
PÁGINA DE EXAMEN DEL PACIENTE: Al abrir el historial de un paciente, mostrar:
Nombre del paciente
Edad
Número de teléfono
Estudio solicitado
Fecha del examen
REDACCIÓN DE INFORMES: Proporcionar plantillas de informes rápidos para hallazgos ecográficos comunes:
Ecografía abdominal normal
Esteatosis hepática
Cálculos biliares
Riñones normales
Ecografía tiroidea normal
Embarazo en el primer trimestre
Permitir que el médico edite el informe manualmente.
CARGA DE IMÁGENES: Permitir cargar múltiples ecografías en formato JPG.
GENERACIÓN DE INFORMES EN PDF: Añadir un botón llamado "Generar informe". El PDF debe incluir:
Logotipo de la clínica
Información del paciente
Fecha
Texto del informe de ecografía
Imágenes de ecografía
ENTREGA DE INFORMES POR WHATSAPP. Agregar el botón "Enviar informe por WhatsApp".
El sistema debe generar un mensaje y adjuntar el informe en PDF.
HISTORIAL DEL PACIENTE: Permitir la búsqueda de pacientes y la visualización de sus estudios previos.
INTERFAZ SIMPLE: La interfaz debe estar optimizada para su uso en dispositivos móviles y tabletas durante las ecografías.
Objetivo: Crear un sistema RIS ligero para una pequeña consulta de ecografía.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://minirisdemo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c65d6c21-afbb-45be-924c-db640de35b80).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
