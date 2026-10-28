import { STORE } from "./config.js";

const pages = {
  privacidade: {
    title: "Privacidade",
    body: `
      <p>A ${STORE.legal}, CNPJ ${STORE.cnpj}, é quem responde por este site. Os sócios são ${STORE.partners.join(" e ")}.</p>
      <p>A Master Bu não cria conta de cliente. Não há cadastro, senha de comprador nem carrinho. O pedido é combinado no WhatsApp e no Instagram <a href="${STORE.instagramUrl}">${STORE.instagram}</a>.</p>
      <p>Se você aceitar os cookies de visita, guardamos a página aberta, o endereço IP e a cidade, uma vez por dia. Isso serve para o painel da loja saber o movimento do site. Se escolher “Só o necessário”, essa visita não é registrada. A escolha fica só no seu navegador.</p>
      <p>A foto, o nome e o preço dos produtos são públicos porque fazem parte da vitrine. A conversa da compra acontece no WhatsApp, fora deste site, e segue as regras de lá.</p>
      <p>Para falar sobre um dado seu, use o contato da loja.</p>`,
  },
  cookies: {
    title: "Cookies",
    body: `
      <p>O aviso no rodapé tem duas escolhas.</p>
      <p><strong>Só o necessário</strong> grava apenas essa escolha neste navegador. Nenhuma visita é enviada.</p>
      <p><strong>Aceitar</strong> permite registrar, uma vez por dia, a página, o IP e a cidade. Usamos isso só no painel da loja.</p>
      <p>Não usamos cookie de anúncio, cupom ou conta de cliente. Você pode mudar de ideia apagando os dados deste site no navegador; o aviso volta a aparecer.</p>`,
  },
  envio: {
    title: "Envio",
    body: `
      <p>O site não fecha a compra e não calcula frete. O envio é combinado no WhatsApp antes de o pedido ficar acertado: destino, prazo e valor do frete.</p>
      <p>A carta ou o lacrado sai depois dessa combinação. Se o item for pré-venda ou sob encomenda, o prazo também é o que for falado na conversa, porque o produto ainda não está na prateleira.</p>`,
  },
  trocas: {
    title: "Trocas",
    body: `
      <p>A ficha do item mostra coleção, número, condição, idioma e acabamento. Confira isso antes de chamar no WhatsApp.</p>
      <p>Se o que chegou for diferente do que foi combinado, fale com a loja pelo WhatsApp assim que perceber. A troca depende do estado do item e do que foi descrito na ficha.</p>
      <p>Compra combinada à distância pode ter o prazo de arrependimento previsto no Código de Defesa do Consumidor. Como o pedido fecha na conversa, e não num checkout deste site, o pedido de arrependimento também é feito por ali.</p>`,
  },
  reembolso: {
    title: "Reembolso",
    body: `
      <p>Este site não recebe pagamento. Não há cartão, boleto, pix nem carrinho aqui.</p>
      <p>Se um reembolso for combinado, ele segue o meio usado na conversa do WhatsApp, pelo valor acertado entre você e a loja. O prazo é o da combinação e o da forma de pagamento usada fora do site.</p>`,
  },
};

export function legal(name) {
  return pages[name] || null;
}
