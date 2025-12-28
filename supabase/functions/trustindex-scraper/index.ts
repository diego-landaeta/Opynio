// supabase/functions/trustindex-scraper/index.ts
// FIX: Add Deno type declarations for the Supabase Edge Function environment.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Hybrid scraper that tries API first, falls back to HTML parsing
class TrustIndexHybridScraper {
  async scrapeReviews(url) {
    try {
      console.log(`Iniciando scraping híbrido para: ${url}`);
      if (!this.isValidTrustIndexUrl(url)) {
        return this.errorResponse("URL no válida. Debe ser una URL de TrustIndex (trustindex.io)");
      }
      const initialHtml = await this.fetchInitialHtml(url);
      const businessName = this.extractBusinessName(initialHtml);
      // Método 1: Intentar API de TrustIndex
      try {
        console.log("Método 1: Intentando API de TrustIndex...");
        const apiResult = await this.tryApiMethod(initialHtml, businessName);
        if (apiResult.success && apiResult.reviews.length > 0) {
          console.log(`API exitosa: ${apiResult.reviews.length} reseñas encontradas`);
          return apiResult;
        }
      } catch (apiError) {
        console.log(`API falló: ${apiError.message}`);
      }
      // Método 2: Scraping HTML como respaldo
      console.log("Método 2: Fallback a scraping HTML...");
      const htmlResult = await this.tryHtmlScraping(initialHtml, businessName);
      if (htmlResult.success && htmlResult.reviews.length > 0) {
        console.log(`HTML scraping exitoso: ${htmlResult.reviews.length} reseñas encontradas`);
        return htmlResult;
      }
      return this.errorResponse("No se pudieron encontrar reseñas nativas de TrustIndex con ningún método. La página podría tener solo reseñas de otras plataformas como Google o Facebook.");
    } catch (error) {
      console.error('Error general en scraping:', error);
      return this.errorResponse(`Error interno: ${error.message}`);
    }
  }
  // Intenta el método API
  async tryApiMethod(html, businessName) {
    const pageId = this.extractPageId(html);
    if (!pageId) {
      throw new Error("No se pudo extraer page_id para API");
    }
    console.log(`Intentando API con page_id: ${pageId}`);
    // Probar diferentes endpoints y métodos
    const apiAttempts = [
      {
        url: 'https://admin.trustindex.io/api/getreviews',
        method: 'POST',
        data: new FormData()
      },
      {
        url: 'https://api.trustindex.io/reviews',
        method: 'GET',
        data: null
      }
    ];
    for (const attempt of apiAttempts){
      try {
        let response;
        if (attempt.method === 'POST') {
          const formData = new FormData();
          formData.append('page_id', pageId);
          formData.append('page', '1');
          formData.append('filter', '');
          response = await fetch(attempt.url, {
            method: 'POST',
            body: formData,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://admin.trustindex.io/'
            }
          });
        } else {
          response = await fetch(`${attempt.url}?page_id=${pageId}&filter=`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
        }
        if (response.ok) {
          const apiResponse = await response.json();
          if (apiResponse.reviews && apiResponse.reviews.length > 0) {
            const reviews = this.mapApiReviews(apiResponse.reviews);
            return {
              success: true,
              reviews,
              totalReviews: reviews.length,
              averageRating: this.calculateAverageRating(reviews),
              businessName,
              source: "trustindex_api"
            };
          }
        }
      } catch (attemptError) {
        console.log(`API attempt failed: ${attemptError.message}`);
        continue;
      }
    }
    throw new Error("Todos los intentos de API fallaron");
  }
  // Método de scraping HTML
  async tryHtmlScraping(html, businessName) {
    const reviews = this.parseHtmlForReviews(html);
    if (reviews.length === 0) {
      throw new Error("No se encontraron reseñas en HTML");
    }
    return {
      success: true,
      reviews,
      totalReviews: reviews.length,
      averageRating: this.calculateAverageRating(reviews),
      businessName,
      source: "html_parsing"
    };
  }
  // Parsear HTML para encontrar reseñas - MEJORADO para mayor cobertura
  parseHtmlForReviews(html) {
    const reviews = [];
    // Múltiples pasadas con diferentes estrategias
    console.log("Iniciando múltiples pasadas de extracción...");
    // Pasada 1: Patrones específicos de TrustIndex
    this.extractWithPatterns(html, [
      /<div[^>]*class="[^"]*ti-review[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*data-ti-review[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*trustindex[^"]*review[^"]*"[^>]*>(.*?)<\/div>/gis
    ], reviews, "TrustIndex específicos");
    // Pasada 2: Patrones generales de reseñas
    if (reviews.length < 10) {
      this.extractWithPatterns(html, [
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>(.*?)<\/div>/gis,
        /<div[^>]*data-review[^>]*>(.*?)<\/div>/gis,
        /<article[^>]*class="[^"]*review[^"]*"[^>]*>(.*?)<\/article>/gis
      ], reviews, "patrones generales");
    }
    // Pasada 3: Buscar en scripts JSON embebidos
    if (reviews.length < 5) {
      this.extractFromJsonData(html, reviews);
    }
    // Pasada 4: Patrones muy amplios como último recurso
    if (reviews.length < 3) {
      this.extractWithBroadPatterns(html, reviews);
    }
    const filtered = this.filterDuplicateReviews(reviews);
    console.log(`Total reseñas extraídas: ${filtered.length}`);
    return filtered;
  }
  // Extraer com padrões específicos
  extractWithPatterns(html, patterns, reviews, passName) {
    console.log(`Pasada: ${passName}`);
    const initialCount = reviews.length;
    for (const pattern of patterns){
      const matches = html.matchAll(pattern);
      for (const match of matches){
        if (reviews.length >= 100) break;
        try {
          const reviewHtml = match[1];
          // Filtrar respostas/replies
          if (this.isReplyOrResponse(reviewHtml)) {
            continue;
          }
          // Filtrar se for obviamente do Google
          if (this.isObviouslyGoogle(reviewHtml)) {
            continue;
          }
          const review = this.parseIndividualReview(reviewHtml, reviews.length);
          if (review && this.isValidReview(review) && !this.isDuplicate(review, reviews)) {
            reviews.push(review);
          }
        } catch (error) {
          continue;
        }
      }
    }
    console.log(`${passName}: ${reviews.length - initialCount} novas avaliações encontradas`);
  }
  // Detectar respostas/replies em vez de avaliações originais
  isReplyOrResponse(htmlContent) {
    const replyIndicators = [
      /class="[^"]*reply[^"]*"/i,
      /class="[^"]*response[^"]*"/i,
      /data-reply/i,
      /en\s+respuesta\s+a/i,
      /reply\s+to/i,
      /respondiendo\s+a/i,
      /@\w+/ // Menções tipo @username
    ];
    return replyIndicators.some((pattern)=>pattern.test(htmlContent));
  }
  // Extrair de dados JSON embutidos
  extractFromJsonData(html, reviews) {
    console.log("Pasada: JSON embutido");
    const initialCount = reviews.length;
    const jsonPatterns = [
      /window\.trustindex_reviews\s*=\s*(\[.*?\]);/s,
      /reviews:\s*(\[.*?\])/s,
      /"reviews":\s*(\[.*?\])/s,
      /reviewsData\s*:\s*(\[.*?\])/s
    ];
    for (const pattern of jsonPatterns){
      const match = html.match(pattern);
      if (match) {
        try {
          const jsonData = JSON.parse(match[1]);
          if (Array.isArray(jsonData)) {
            jsonData.forEach((item, index)=>{
              const review = this.parseJsonReview(item, reviews.length + index);
              if (review && !this.isDuplicate(review, reviews)) {
                reviews.push(review);
              }
            });
          }
        } catch (error) {
          continue;
        }
      }
    }
    console.log(`JSON embutido: ${reviews.length - initialCount} novas avaliações encontradas`);
  }
  // Extrair com padrões amplos
  extractWithBroadPatterns(html, reviews) {
    console.log("Pasada: padrões amplos");
    const initialCount = reviews.length;
    // Buscar padrões de nome + data + conteúdo
    const broadPatterns = [
      /([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]{3,40})\s+(\d{4}[.-]\d{2}[.-]\d{2}).*?([A-Za-záéíóúüñÁÉÍÓÚÜÑ][^\n<>]{15,400})/g,
      /"([^"]{20,400})"\s*-?\s*([A-Za-záéíóúüñÁÉÍÓÚÜÑ\s]{3,40})/g
    ];
    for (const pattern of broadPatterns){
      const matches = html.matchAll(pattern);
      for (const match of matches){
        if (reviews.length >= 100) break;
        try {
          const review = this.parsePatternMatch(match, reviews.length);
          if (review && !this.isDuplicate(review, reviews)) {
            reviews.push(review);
          }
        } catch (error) {
          continue;
        }
      }
    }
    console.log(`Padrões amplos: ${reviews.length - initialCount} novas avaliações encontradas`);
  }
  // Parse de match de padrão amplo
  parsePatternMatch(match, index) {
    let authorName = match[1] || match[2] || '';
    let reviewText = match[3] || match[1] || '';
    // Determinar qual é nome e qual é texto
    if (match[1] && match[3] && match[3].length > match[1].length) {
      authorName = match[1];
      reviewText = match[3];
    }
    if (!this.isValidReviewerName(authorName) || !this.isValidText(reviewText)) {
      return null;
    }
    return {
      id: `ti-broad-${index}`,
      author: `${authorName.trim()}`,
      rating: 5,
      text: reviewText.trim(),
      title: `Avaliação de 5 estrelas no TrustIndex`,
      date: new Date().toISOString(),
      platform: 'trustindex',
      verified: false,
      helpful: 0,
      avatar: ''
    };
  }
  // Parse de avaliação JSON
  parseJsonReview(item, index) {
    const authorName = item.author || item.name || item.reviewer_name;
    const reviewText = item.text || item.content || item.review;
    const rating = parseInt(item.rating || item.stars || 5);
    if (!authorName || !reviewText || !this.isValidReviewerName(authorName)) {
      return null;
    }
    return {
      id: item.id || `ti-json-${index}`,
      author: `avaliação de @${authorName}`,
      rating: Math.min(Math.max(rating, 1), 5),
      text: reviewText,
      title: `Avaliação de ${rating} estrela${rating > 1 ? 's' : ''} no TrustIndex`,
      date: item.date || new Date().toISOString(),
      platform: 'trustindex',
      verified: true,
      helpful: 0,
      avatar: item.avatar || ''
    };
  }
  // Verificar duplicados
  isDuplicate(review, existingReviews) {
    const reviewKey = review.text.substring(0, 30).toLowerCase().trim();
    return existingReviews.some((existing)=>existing.text.substring(0, 30).toLowerCase().trim() === reviewKey);
  }
  // Parse de avaliação individual do HTML - SEM duplicação
  parseIndividualReview(htmlContent, index) {
    try {
      const authorName = this.extractAuthorFromHtml(htmlContent, index);
      const reviewText = this.extractTextFromHtml(htmlContent);
      const rating = this.extractRating(htmlContent);
      const date = this.extractDate(htmlContent);
      if (!reviewText || reviewText.length < 5) {
        return null;
      }
      return {
        id: `ti-html-${index}-${Date.now()}`,
        author: `avaliação de @${authorName}`,
        rating: Math.min(Math.max(rating, 1), 5),
        text: reviewText,
        title: `Avaliação de ${rating} estrela${rating > 1 ? 's' : ''} no TrustIndex`,
        date,
        platform: 'trustindex',
        verified: htmlContent.includes('verified') || htmlContent.includes('✓'),
        helpful: 0,
        avatar: this.extractAvatar(htmlContent)
      };
    } catch (error) {
      return null;
    }
  }
  // Extrair autor do HTML - MELHORADO para nomes reais
  extractAuthorFromHtml(htmlContent, index) {
    // Limpar o HTML primeiro
    const cleanContent = htmlContent.replace(/<script[^>]*>.*?<\/script>/gis, '').replace(/<style[^>]*>.*?<\/style>/gis, '');
    const patterns = [
      // Padrões JSON específicos
      /"(?:author|reviewer_name|name|user_name)"\s*:\s*"([A-Za-záéíóúüñÁÉÍÓÚÜÑ][^"]{1,40})"/i,
      // Padrões HTML mais específicos para nomes reais
      /<(?:span|div|strong|b|h[1-6])[^>]*class="[^"]*(?:author|reviewer|name|user)[^"]*"[^>]*>\s*([A-Za-záéíóúüñÁÉÍÓÚÜÑ][A-Za-záéíóúüñÁÉÍÓÚÜÑ\s]{1,40})\s*<\/[^>]*>/i,
      // Padrões para nomes completos
      /<[^>]*>\s*([A-Za-záéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+){1,3})\s*<\/[^>]*>/g,
      // Padrões para nomes curtos como "mm jj"
      /<[^>]*>\s*([a-zA-Z]{1,4}\s+[a-zA-Z]{1,4})\s*<\/[^>]*>/g,
      // Padrões em contexto de datas
      /([A-Za-záéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+){0,2})\s+\d{4}[.-]\d{2}[.-]\d{2}/g,
      // Padrões mais gerais
      />([A-Za-záéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+){1,2})</g,
      // Data attributes
      /data-(?:author|name|reviewer)=["']([A-Za-záéíóúüñÁÉÍÓÚÜÑ][^"']{1,40})["']/i
    ];
    // Tentar padrões individuais primeiro
    for (const pattern of patterns.slice(0, 7)){
      const match = cleanContent.match(pattern);
      if (match && match[1]) {
        const name = this.cleanExtractedName(match[1]);
        if (this.isRealPersonName(name)) {
          console.log(`Nome encontrado com padrão individual: ${name}`);
          return name;
        }
      }
    }
    // Tentar padrões globais para múltiplos candidatos
    const allCandidates = new Set();
    for (const pattern of patterns){
      const matches = cleanContent.matchAll(pattern);
      for (const match of matches){
        if (match && match[1]) {
          const name = this.cleanExtractedName(match[1]);
          if (this.isRealPersonName(name)) {
            allCandidates.add(name);
          }
        }
      }
    }
    // Selecionar o melhor candidato
    if (allCandidates.size > 0) {
      const bestName = this.selectBestName(Array.from(allCandidates));
      console.log(`Melhor nome selecionado de ${allCandidates.size} candidatos: ${bestName}`);
      return bestName;
    }
    console.log(`Nenhum nome real encontrado, usando fallback: Usuário ${index + 1}`);
    return `Usuário ${index + 1}`;
  }
  // Limpar nome extraído
  cleanExtractedName(name) {
    return name.trim().replace(/\s+/g, ' ').replace(/^[^A-Za-záéíóúüñÁÉÍÓÚÜÑ]+/, '').replace(/[^A-Za-záéíóúüñÁÉÍÓÚÜÑ\s]+$/, '');
  }
  // Verificar se é nome de pessoa real
  isRealPersonName(name) {
    if (!name || name.length < 2 || name.length > 50) return false;
    // Padrões específicos a serem rejeitados
    const rejectPatterns = [
      /^Usuario\s*\d*$/i,
      /^User\s*\d*$/i,
      /^Cliente\s*\d*$/i,
      /^Estudiante\s*\d*$/i,
      /^[A-Z]\s+[A-Z]\.?$/,
      /^Google\s+User$/i,
      /^Local\s+Guide$/i,
      /^Guía\s+Local$/i,
      /class\s*=/i,
      /wp-block/i,
      /heading/i,
      /<[^>]+>/,
      /^\w+\s*=\s*["']/,
      /^[0-9]+$/,
      /^[\s\W]*$/,
      /trustindex/i,
      /valoración|rating|estrella/i,
      /reseña|review/i,
      /opinion|comentario/i
    ];
    if (rejectPatterns.some((pattern)=>pattern.test(name))) {
      return false;
    }
    // Deve ter apenas letras válidas
    if (!/^[A-Za-záéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(name)) {
      return false;
    }
    // Padrões que indicam nomes reais
    const validNamePatterns = [
      /^[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+\s+[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+$/,
      /^[a-zA-Z]{1,4}\s+[a-zA-Z]{1,4}$/,
      /^[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{3,}$/ // Nome simples longo
    ];
    return validNamePatterns.some((pattern)=>pattern.test(name));
  }
  // Selecionar o melhor nome de múltiplos candidatos
  selectBestName(candidates) {
    if (candidates.length === 1) return candidates[0];
    // Critérios de seleção (do melhor para o pior):
    // 1. Nomes com nome e sobrenome
    // 2. Nomes mais longos
    // 3. Nomes que não são muito comuns
    const nameScores = candidates.map((name)=>({
        name,
        score: this.calculateNameScore(name)
      }));
    nameScores.sort((a, b)=>b.score - a.score);
    return nameScores[0].name;
  }
  // Calcular score de qualidade do nome
  calculateNameScore(name) {
    let score = 0;
    // Bônus por ter múltiplas palavras (nome + sobrenome)
    const words = name.split(/\s+/).filter((w)=>w.length > 0);
    if (words.length >= 2) score += 10;
    // Bônus por comprimento apropriado
    if (name.length >= 4 && name.length <= 30) score += 5;
    // Penalidade por ser muito curto
    if (name.length < 3) score -= 5;
    // Bônus por caracteres especiais válidos (acentos)
    if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(name)) score += 3;
    // Penalidade por padrões suspeitos
    if (/^[a-z]{1,3}\s*$/.test(name)) score -= 2;
    return score;
  }
  // Extrair texto do HTML
  extractTextFromHtml(htmlContent) {
    const patterns = [
      /<p[^>]*>\s*([^<]{10,500})\s*<\/p>/i,
      /<div[^>]*class="[^"]*(?:text|content|comment)[^"]*"[^>]*>\s*([^<]{10,500})\s*<\/div>/i,
      /"(?:text|content|comment)"\s*:\s*"([^"]{10,500})"/i,
      /<span[^>]*>\s*([A-Za-záéíóúüñÁÉÍÓÚÜÑ][^<]{15,400})\s*<\/span>/i,
      />([A-Za-záéíóúüñÁÉÍÓÚÜÑ][^<>]{20,300})</i
    ];
    for (const pattern of patterns){
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        const text = match[1].trim().replace(/\\n/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
        if (this.isValidText(text)) {
          return text;
        }
      }
    }
    return "";
  }
  // Detectar se é obviamente do Google
  isObviouslyGoogle(htmlContent) {
    const obviousPatterns = [
      /google[^>]*logo/i,
      /maps\.google/i,
      /class="[^"]*google-review/i,
      /data-source="google"/i,
      /gstatic/i,
      /googleusercontent/i,
      /posted.*via.*google/i
    ];
    return obviousPatterns.some((pattern)=>pattern.test(htmlContent));
  }
  // Validar avaliação
  isValidReview(review) {
    return review.author && review.text && review.text.length >= 5 && !this.isGoogleReview(review);
  }
  // Detectar avaliação do Google
  isGoogleReview(review) {
    const authorName = review.author.replace('avaliação de @', '').trim();
    const googlePatterns = [
      /^[A-Z]\s+[A-Z]\.?$/,
      /^Google\s+User$/i,
      /^Local\s+Guide$/i,
      /^Usuario\s+de\s+Google$/i
    ];
    return googlePatterns.some((pattern)=>pattern.test(authorName)) || [
      'posted on google',
      'via google'
    ].some((text)=>(review.text + review.author).toLowerCase().includes(text));
  }
  // Filtrar duplicados
  filterDuplicateReviews(reviews) {
    const seen = new Set();
    return reviews.filter((review)=>{
      const key = review.text.substring(0, 30).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  // Validar texto
  isValidText(text) {
    if (text.length < 5) return false;
    const invalidPatterns = [
      /class\s*=/i,
      /wp-block/i,
      /heading/i,
      /<[^>]+>/,
      /^valoración\s+de\s+\d+\s+estrella/i
    ];
    if (invalidPatterns.some((pattern)=>pattern.test(text))) {
      return false;
    }
    const hasReviewWords = /curso|experiencia|excelente|bueno|recomiendo|aprend|útil|práctic|profesor|terminé/i.test(text);
    const isLongEnough = text.length >= 15 && text.split(/\s+/).length >= 3;
    return hasReviewWords || isLongEnough;
  }
  // Métodos auxiliares reutilizados
  errorResponse(message) {
    return {
      success: false,
      error: message,
      reviews: [],
      totalReviews: 0,
      averageRating: 0,
      businessName: 'Desconhecido',
      source: "error"
    };
  }
  async fetchInitialHtml(url) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
  }
  isValidTrustIndexUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('trustindex.io');
    } catch  {
      return false;
    }
  }
  extractPageId(html) {
    const patterns = [
      /window\.trustindex_page_details\s*=\s*{[\s\S]*?"page_id":\s*(\d+)/,
      /trustindex_page_details\s*=\s*{[\s\S]*?"page_id":\s*(\d+)/,
      /"page_id":\s*(\d+)/,
      /page_id["']?\s*:\s*["']?(\d+)/,
      /data-page-id=["'](\d+)["']/,
      /pageId\s*:\s*["']?(\d+)["']?/
    ];
    for (const pattern of patterns){
      const match = html.match(pattern);
      if (match && match[1]) {
        console.log(`Page ID encontrado: ${match[1]}`);
        return match[1];
      }
    }
    return null;
  }
  extractBusinessName(html) {
    const patterns = [
      /window\.trustindex_page_details\s*=\s*{[\s\S]*?"name":\s*"([^"]+)"/,
      /<title>([^<]+)<\/title>/i
    ];
    for (const pattern of patterns){
      const match = html.match(pattern);
      if (match && match[1]) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch  {
          return match[1].trim().replace(/\s*-\s*TrustIndex.*$/i, '');
        }
      }
    }
    return 'Negócio';
  }
  // Mapeia avaliações da API usando validação de nome aprimorada
  mapApiReviews(apiReviews) {
    console.log(`Processando ${apiReviews.length} avaliações da API`);
    return apiReviews.map((review, index)=>{
      // Extrair e validar nome do revisor
      let reviewerName = review.reviewer_name || review.name || review.author || '';
      reviewerName = this.cleanExtractedName(reviewerName);
      // Usar validação estrita para nomes reais
      if (!this.isRealPersonName(reviewerName)) {
        // Tentar extrair de outros campos se existir
        const alternativeNames = [
          review.display_name,
          review.user_name,
          review.full_name
        ].filter((name)=>name && this.isRealPersonName(this.cleanExtractedName(name)));
        if (alternativeNames.length > 0) {
          reviewerName = this.cleanExtractedName(alternativeNames[0]);
        } else {
          reviewerName = `Usuário ${index + 1}`;
        }
      }
      // Limpar o texto da avaliação
      let reviewText = review.text || review.content || review.review_text || '';
      reviewText = reviewText.replace(/\s+/g, ' ').trim();
      // Validar que não é uma resposta
      if (this.isReplyOrResponse(reviewText)) {
        return null; // Filtrar respostas
      }
      // Validar avaliação
      const rating = Math.min(Math.max(parseInt(review.rating, 10) || 5, 1), 5);
      const mappedReview = {
        id: review.id || `ti-api-${index}`,
        author: `avaliação de @${reviewerName}`,
        rating: rating,
        text: reviewText,
        title: `Avaliação de ${rating} estrela${rating > 1 ? 's' : ''} no TrustIndex`,
        date: review.date_original || review.date || review.created_at || new Date().toISOString(),
        platform: 'trustindex',
        verified: true,
        helpful: parseInt(review.helpful_count || review.likes || 0),
        avatar: review.avatar || review.profile_photo_url || ''
      };
      console.log(`Avaliação API mapeada: ${reviewerName} - ${reviewText.substring(0, 50)}...`);
      return mappedReview;
    }).filter((review)=>review && review.text.length > 0); // Apenas avaliações válidas com conteúdo
  }
  isValidReviewerName(name) {
    if (!name || name.length < 2 || name.length > 50) return false;
    const invalidPatterns = [
      /^[A-Z]\s+[A-Z]\.?$/,
      /^Google\s+User$/i,
      /^Local\s+Guide$/i,
      /class\s*=/i,
      /wp-block/i,
      /<[^>]+>/,
      /^[0-9]+$/,
      /trustindex/i
    ];
    return !invalidPatterns.some((pattern)=>pattern.test(name)) && /[A-Za-záéíóúüñÁÉÍÓÚÜÑ]/.test(name);
  }
  extractRating(htmlContent) {
    const patterns = [
      /"rating"\s*:\s*(\d+)/,
      /data-rating="(\d+)"/,
      /★{1,5}/g,
      /(\d)\s*estrella/i
    ];
    for (const pattern of patterns){
      const match = htmlContent.match(pattern);
      if (match) {
        if (match[0] && match[0].includes('★')) {
          return Math.min(match[0].length, 5);
        } else if (match[1]) {
          const rating = parseInt(match[1]);
          if (rating >= 1 && rating <= 5) return rating;
        }
      }
    }
    return 5;
  }
  extractAvatar(htmlContent) {
    const patterns = [
      /src="([^"]*(?:avatar|profile)[^"]*)"/i,
      /"avatar"\s*:\s*"([^"]+)"/
    ];
    for (const pattern of patterns){
      const match = htmlContent.match(pattern);
      if (match && match[1] && !match[1].includes('google')) {
        return match[1].trim();
      }
    }
    return "";
  }
  extractDate(htmlContent) {
    const patterns = [
      /"date"\s*:\s*"([^"]+)"/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/
    ];
    for (const pattern of patterns){
      const match = htmlContent.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return new Date().toISOString();
  }
  calculateAverageRating(reviews) {
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review)=>sum + review.rating, 0);
    return Math.round(totalRating / reviews.length * 10) / 10;
  }
}
// Supabase Edge Function handler
serve(async (req)=>{
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Método não permitido'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL requerida'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Processando solicitação para URL: ${url}`);
    const scraper = new TrustIndexHybridScraper();
    const result = await scraper.scrapeReviews(url);
    console.log(`Resultado: ${result.success ? 'exitoso' : 'falhou'}, ${result.reviews.length} avaliações encontradas`);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
