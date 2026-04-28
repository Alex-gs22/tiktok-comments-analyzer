/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // IMPORTANTE: Si tu repositorio en GitHub no es la página principal (ej. username.github.io),
  // y se llama "mi-proyecto", debes descomentar la siguiente línea y poner el nombre del repo:
  // basePath: '/mi-proyecto',
};

export default nextConfig;
