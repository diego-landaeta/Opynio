// services/serpApiService.ts
// Service for importing Google Reviews using SerpApi

export interface SerpApiReview {
  author: string;
  rating: number;
  date: string;
  snippet: string;
  likes?: number;
  user_thumbnail?: string;
}

export interface SerpApiBusinessInfo {
  title: string;
  type?: string;
  address?: string;
  phone?: string;
  website?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
}

export interface SerpApiImportResult {
  reviews: SerpApiReview[];
  business_info?: SerpApiBusinessInfo;
  total_reviews?: number;
}

export interface TrustIndexReview {
  author: string;
  rating: number;
  date: string;
  snippet: string;
  source?: string;
}

export interface TrustIndexImportResult {
  reviews: TrustIndexReview[];
  total_reviews?: number;
}

class GoogleReviewsImporter {
  private apiKey: string;
  private baseUrl = 'https://serpapi.com/search.json';

  constructor() {
    this.apiKey = import.meta.env.VITE_SERPAPI_KEY || '';
    if (!this.apiKey) {
      console.warn('SERPAPI_KEY not found in environment variables. Google reviews import will not work.');
    }
  }

  /**
   * Extract data_id from Google Maps URL
   */
  private extractDataId(url: string): string | null {
    // Try to extract from various Google Maps URL formats
    const patterns = [
      /data=([^&]+)/,
      /0x[a-f0-9]+:0x[a-f0-9]+/i,
      /place\/[^/]+\/([^/?]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Fetch reviews from SerpApi with pagination
   */
  async importAllReviews(
    googleMapsUrl: string,
    onProgress?: (message: string) => void
  ): Promise<SerpApiImportResult> {
    if (!this.apiKey) {
      throw new Error('SerpApi key is not configured. Please add VITE_SERPAPI_KEY to your .env file.');
    }

    const dataId = this.extractDataId(googleMapsUrl);
    if (!dataId) {
      throw new Error('No se pudo extraer el ID del negocio de la URL de Google Maps proporcionada.');
    }

    onProgress?.('Conectando con SerpApi...');

    const allReviews: SerpApiReview[] = [];
    let businessInfo: SerpApiBusinessInfo | undefined;
    let nextPageToken: string | undefined;
    let page = 1;

    try {
      do {
        onProgress?.(`Obteniendo página ${page} de reseñas...`);

        const params = new URLSearchParams({
          engine: 'google_maps_reviews',
          data_id: dataId,
          api_key: this.apiKey,
          hl: 'es',
        });

        if (nextPageToken) {
          params.append('next_page_token', nextPageToken);
        }

        const response = await fetch(`${this.baseUrl}?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`SerpApi error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Extract business info from first page
        if (page === 1 && data.place_info) {
          businessInfo = {
            title: data.place_info.title || '',
            type: data.place_info.type || '',
            address: data.place_info.address || '',
            phone: data.place_info.phone || '',
            website: data.place_info.website || '',
            thumbnail: data.place_info.thumbnail || '',
            rating: data.place_info.rating || 0,
            reviews: data.place_info.reviews || 0,
          };
        }

        // Extract reviews
        if (data.reviews && Array.isArray(data.reviews)) {
          const reviews: SerpApiReview[] = data.reviews.map((review: any) => ({
            author: review.user?.name || 'Usuario Anónimo',
            rating: review.rating || 0,
            date: review.date || new Date().toISOString(),
            snippet: review.snippet || '',
            likes: review.likes || 0,
            user_thumbnail: review.user?.thumbnail || '',
          }));

          allReviews.push(...reviews);
          onProgress?.(`Se encontraron ${reviews.length} reseñas en esta página. Total: ${allReviews.length}`);
        }

        // Check for next page
        nextPageToken = data.serpapi_pagination?.next_page_token;
        page++;

        // Delay between requests to avoid rate limiting
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } while (nextPageToken && page <= 10); // Limit to 10 pages max

      onProgress?.(`Importación completa: ${allReviews.length} reseñas obtenidas de Google.`);

      return {
        reviews: allReviews,
        business_info: businessInfo,
        total_reviews: allReviews.length,
      };

    } catch (error: any) {
      console.error('Error importing Google reviews:', error);
      throw new Error(`Error al importar reseñas de Google: ${error.message}`);
    }
  }

  /**
   * Test if the API key is valid
   */
  async testApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const params = new URLSearchParams({
        engine: 'google',
        q: 'test',
        api_key: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

class TrustIndexReplacementImporter {
  /**
   * Import reviews from TrustIndex page
   */
  async importReviews(
    trustindexUrl: string,
    onProgress?: (message: string) => void
  ): Promise<TrustIndexImportResult> {
    onProgress?.('Iniciando importación desde TrustIndex...');

    try {
      onProgress?.('Obteniendo reseñas de TrustIndex...');

      // Note: This is a placeholder implementation
      // In a real scenario, you would need to implement scraping logic
      // or use an API if TrustIndex provides one

      throw new Error('La importación desde TrustIndex requiere configuración adicional. Por favor, contacta con soporte.');

    } catch (error: any) {
      console.error('Error importing TrustIndex reviews:', error);
      throw new Error(`Error al importar reseñas de TrustIndex: ${error.message}`);
    }
  }
}

export const googleReviewsImporter = new GoogleReviewsImporter();
export const trustIndexReplacementImporter = new TrustIndexReplacementImporter();
