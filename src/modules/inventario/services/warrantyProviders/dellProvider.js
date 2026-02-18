// Dell warranty provider — stub
// Dell no ofrece API pública y su web está protegida por Akamai anti-bot.
// Este provider existe para que los artículos Dell se marquen correctamente
// como 'sin_garantia' en lugar de intentar un scraping que falla.

const dellProvider = {
  marca: 'dell',
  campoIdentificador: 'service_tag',

  async consultarGarantia(_serviceTag) {
    return {
      success: false,
      error: 'Consulta de garantía Dell no disponible (requiere acceso API o headless browser)'
    };
  }
};

export default dellProvider;
