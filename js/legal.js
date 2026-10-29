import { STORE, WHATSAPP_PHONE } from "./config.js";

const UPDATED = "29 de outubro de 2026";

function whatsapp() {
  const digits = String(WHATSAPP_PHONE || "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const shown = local.length === 11 ? `${local.slice(0, 2)} ${local.slice(2, 7)}-${local.slice(7)}` : local;
  const href = digits ? `https://api.whatsapp.com/send?phone=${digits}` : "#/contato";
  return `<a href="${href}">WhatsApp</a>${shown ? `, no número ${shown}` : ""}`;
}

const pages = {
  privacidade: {
    title: "Política de Privacidade",
    body: `
      <p>Esta Política descreve o tratamento de dados pessoais realizado no site da ${STORE.name}, em conformidade com a Lei nº 13.709, de 14 de agosto de 2018 (Lei Geral de Proteção de Dados Pessoais).</p>
      <h2>Controlador</h2>
      <p>O controlador, nos termos do art. 5º, inciso VI, da Lei nº 13.709/2018, é a ${STORE.legal}, CNPJ ${STORE.cnpj}, representada pelos sócios ${STORE.partners.join(" e ")}. Requerimentos sobre dados pessoais devem ser encaminhados pelo ${whatsapp()}.</p>
      <h2>Dados tratados</h2>
      <ul>
        <li>Pedido: ao acionar Comprar, abre-se conversa no WhatsApp com o produto, a coleção, o número, o idioma, a condição, o acabamento e o preço. O site não cria conta de cliente nem carrinho. Essa conversa observa também as regras daquela plataforma.</li>
        <li>Visita, somente com consentimento: página acessada, endereço IP e cidade aproximada, uma vez por dia, para mensurar o acesso ao catálogo.</li>
        <li>Preferência do aviso neste aparelho: autorizar a contagem de visitas ou manter apenas o necessário.</li>
      </ul>
      <h2>Finalidades e bases legais</h2>
      <p>O tratamento observa o art. 7º da Lei nº 13.709/2018. Atendimento e formação do pedido apoiam-se na execução de contrato ou de procedimentos preliminares relacionados a contrato de que seja parte o titular (inciso V). O registro de visita com endereço IP e cidade apoia-se no consentimento (inciso I), que pode ser revogado a qualquer momento, de forma gratuita e facilitada, nos termos do art. 8º, § 5º. As informações prestadas ao titular observam o art. 9º da mesma lei.</p>
      <h2>Compartilhamento</h2>
      <p>A ${STORE.name} não comercializa dados pessoais. As visitas consentidas são armazenadas na Supabase. O site é hospedado na Vercel. A cidade aproximada decorre de consulta do endereço IP ao serviço ipwho.is. O pedido é transmitido ao WhatsApp quando o consumidor aciona Comprar. Esses operadores podem manter dados fora do Brasil, hipótese em que a transferência observa o art. 33 da Lei nº 13.709/2018 e restringe-se às finalidades desta Política.</p>
      <h2>Conservação</h2>
      <p>Os registros de visita permanecem para a contagem de acessos e podem ser eliminados a pedido do titular. A preferência do aviso permanece neste aparelho até ser apagada.</p>
      <h2>Direitos do titular</h2>
      <p>Nos termos do art. 18 da Lei nº 13.709/2018, o titular pode requerer confirmação da existência de tratamento, acesso aos dados, correção, portabilidade, eliminação, informação sobre as entidades com as quais os dados foram compartilhados e revogação do consentimento. A declaração clara e completa será fornecida no prazo de até 15 (quinze) dias, contado do requerimento, conforme o art. 19, inciso II, da mesma lei. É facultado ao titular apresentar reclamação à Autoridade Nacional de Proteção de Dados, em gov.br/anpd.</p>
      <h2>Crianças e adolescentes</h2>
      <p>O tratamento de dados de crianças e de adolescentes observa o art. 14 da Lei nº 13.709/2018. A loja não solicita, de modo intencional, dados de crianças.</p>
      <p>Atualizada em ${UPDATED}.</p>`,
  },
  cookies: {
    title: "Política de Cookies",
    body: `
      <p>Esta Política descreve os dados armazenados no aparelho do usuário. O site não emprega cookies de publicidade. O tratamento observa a Lei nº 13.709/2018 e a <a href="#/privacidade">Política de Privacidade</a>.</p>
      <h2>Dados necessários</h2>
      <p>O site guarda neste aparelho a opção registrada neste aviso: autorizar a contagem de visitas ou manter apenas o necessário.</p>
      <ul>
        <li>A escolha deste aviso, para não perguntar de novo a cada visita.</li>
      </ul>
      <h2>Dados dependentes de consentimento</h2>
      <p>O registro da página visitada, do endereço IP e da cidade aproximada somente ocorre com consentimento, nos termos do art. 7º, inciso I, e do art. 8º da Lei nº 13.709/2018. Sem essa autorização, a visita não é registrada.</p>
      <h2>Revogação</h2>
      <p>O consentimento pode ser revogado a qualquer momento, nos termos do art. 8º, § 5º, da Lei nº 13.709/2018. A exclusão dos dados locais, nas configurações do navegador, faz com que o aviso seja apresentado novamente na visita seguinte. A eliminação do que já houver sido registrado pela loja deve ser solicitada pelo ${whatsapp()}.</p>
      <p>Atualizada em ${UPDATED}.</p>`,
  },
  envio: {
    title: "Política de Envio e Entrega",
    body: `
      <p>Esta Política disciplina o envio e a entrega dos produtos comercializados pela ${STORE.name}. Prazo, modalidade e custo são informados de modo claro, nos termos do art. 6º, inciso III, e do art. 31 da Lei nº 8.078/1990, e do art. 2º, incisos IV e V, do Decreto nº 7.962/2013.</p>
      <h2>Modalidades</h2>
      <p>O site não calcula frete nem conclui a compra. As opções de envio e os respectivos valores são informados no atendimento pelo ${whatsapp()}, antes da confirmação do pedido.</p>
      <h2>Postagem</h2>
      <p>Confirmado o pagamento na conversa, o pedido é preparado para envio. O prazo estimado de postagem é informado durante a compra. Em pré-venda ou sob encomenda, o prazo é o combinado, porque o produto ainda pode não estar na prateleira.</p>
      <h2>Entrega</h2>
      <p>O prazo de entrega varia conforme o destino e a modalidade escolhida. A estimativa é apresentada antes da confirmação e pode ser alterada por fato relacionado ao transporte.</p>
      <h2>Rastreamento</h2>
      <p>Quando a modalidade o fornecer, o código de rastreamento será encaminhado ao consumidor para acompanhamento do pedido.</p>
      <h2>Endereço</h2>
      <p>Cabe ao consumidor conferir o endereço de entrega antes da conclusão da compra. Divergência deve ser comunicada imediatamente pelo ${whatsapp()}.</p>
      <h2>Atraso ou extravio</h2>
      <p>Em caso de atraso, não recebimento ou avaria no transporte, o consumidor deve contatar o fornecedor pelo ${whatsapp()}. A ocorrência será verificada e orientada, sem prejuízo dos direitos previstos na Lei nº 8.078/1990, em especial os arts. 18 e 26.</p>
      <h2>Acondicionamento</h2>
      <p>Os produtos são embalados de modo a reduzir o risco de dano no transporte. A embalagem pode variar conforme o item adquirido.</p>`,
  },
  trocas: {
    title: "Política de Trocas e Devoluções",
    body: `
      <p>Esta Política disciplina as trocas e as devoluções, em conformidade com a Lei nº 8.078/1990.</p>
      <h2>Direito de arrependimento</h2>
      <p>Nas contratações realizadas fora do estabelecimento comercial, inclusive pelo WhatsApp, o consumidor pode desistir do contrato no prazo de 7 (sete) dias, contado da assinatura ou do ato de recebimento do produto, nos termos do art. 49 da Lei nº 8.078/1990. Exercido o direito, os valores eventualmente pagos serão devolvidos de imediato, monetariamente atualizados, conforme o parágrafo único desse artigo.</p>
      <h2>Procedimento</h2>
      <p>A solicitação deve ser feita pelo ${whatsapp()}, com a identificação do pedido. O fornecedor informará o modo de devolução do produto.</p>
      <h2>Estado de conservação</h2>
      <p>As cartas podem ser ofertadas em diferentes estados de conservação. Descrição e imagens integram a oferta e vinculam o fornecedor, nos termos dos arts. 30 e 31 da Lei nº 8.078/1990. Recomenda-se a leitura da ficha — coleção, número, condição, idioma e acabamento — antes da compra.</p>
      <h2>Vício do produto</h2>
      <p>Produto danificado, trocado ou em desacordo com a oferta sujeita o fornecedor ao art. 18 da Lei nº 8.078/1990. Não sanado o vício no prazo máximo de 30 (trinta) dias, o consumidor pode exigir, à sua escolha, a substituição do produto, a restituição da quantia paga ou o abatimento proporcional do preço, na forma do § 1º desse artigo. O prazo para reclamar de vício aparente ou de fácil constatação em produto durável é de 90 (noventa) dias, contado da entrega efetiva (art. 26, inciso II, e § 1º). Tratando-se de vício oculto, o prazo inicia-se no momento em que ficar evidenciado o defeito (art. 26, § 3º).</p>
      <h2>Custos da devolução</h2>
      <p>As despesas de devolução serão definidas conforme a causa do pedido e a legislação aplicável. A restituição de valores, quando devida, observa a <a href="#/reembolso">Política de Reembolso e Cancelamento</a>.</p>`,
  },
  reembolso: {
    title: "Política de Reembolso e Cancelamento",
    body: `
      <p>Esta Política disciplina o cancelamento de pedidos e a restituição de valores pagos à ${STORE.name}, sem prejuízo da Lei nº 8.078/1990. O pagamento não é recebido neste site: não há cartão, boleto, Pix nem carrinho aqui. O valor é acertado na conversa do WhatsApp.</p>
      <h2>Antes da postagem</h2>
      <p>O cancelamento anterior ao envio deve ser solicitado pelo ${whatsapp()}. O fornecedor verificará o estágio do pedido e informará o procedimento cabível.</p>
      <h2>Depois da postagem</h2>
      <p>Se o produto já houver sido despachado, o consumidor deve contatar o fornecedor pelo mesmo canal. Permanecem assegurados os direitos legais, inclusive o de arrependimento, quando presente a hipótese do art. 49 da Lei nº 8.078/1990.</p>
      <h2>Arrependimento</h2>
      <p>Nas compras concluídas fora do estabelecimento, o prazo de desistência é de 7 (sete) dias, contado da assinatura ou do recebimento do produto (art. 49 da Lei nº 8.078/1990). Exercido o direito, os valores pagos serão devolvidos de imediato, monetariamente atualizados (parágrafo único do mesmo artigo).</p>
      <h2>Inexecução da oferta e vício</h2>
      <p>Se o fornecedor recusar o cumprimento de oferta confirmada, o consumidor poderá escolher entre o cumprimento forçado, produto equivalente ou a rescisão com restituição da quantia antecipada, monetariamente atualizada, e perdas e danos, nos termos do art. 35 da Lei nº 8.078/1990. Produto com vício observa o art. 18 e o seu § 1º: não sanado o defeito em até 30 (trinta) dias, cabem a substituição, a restituição integral ou o abatimento proporcional do preço.</p>
      <h2>Forma da restituição</h2>
      <p>A restituição, quando devida, será processada pelo meio de pagamento utilizado na compra. O lançamento em fatura ou conta pode observar o prazo da instituição de pagamento, o que não afasta o dever legal de devolução imediata e atualizada.</p>
      <h2>Contato</h2>
      <p>Pedidos de cancelamento ou de restituição devem ser dirigidos ao ${whatsapp()} indicado neste site.</p>`,
  },
};

export function legal(name) {
  return pages[name] || null;
}
