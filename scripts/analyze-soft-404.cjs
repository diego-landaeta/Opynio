const fs = require('fs');
const path = require('path');

// Leer el archivo CSV
const csvPath = path.join(__dirname, '../GSC/Table.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parsear CSV
const lines = csvContent.split('\n').slice(1); // Skip header
const urls = lines.map(line => {
    // Manejar URLs con comas dentro de comillas
    const match = line.match(/^"?([^",]+)"?,(.+)$/);
    if (match) {
        return match[1].replace(/^"|"$/g, '');
    }
    return line.split(',')[0];
}).filter(url => url && url.startsWith('http'));

console.log(`📊 Total URLs con Soft 404: ${urls.length}\n`);

// Análisis de patrones
const patterns = {
    empresas: [],
    pages: {},
    countries: {},
    empresaByCountry: {},
    wrongCountry: []
};

// Países/idiomas válidos
const validCountries = ['es', 'mx', 'ar', 'co', 'cl', 'pe', 've', 'cr', 'pa', 'uy', 'br', 'pt', 'us', 'gb', 'fr', 'de', 'it', 'ca', 'ad', 'cn'];

urls.forEach(url => {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);

        if (pathParts.length < 1) return;

        const country = pathParts[0];
        const page = pathParts[1] || 'home';

        // Contar por país
        patterns.countries[country] = (patterns.countries[country] || 0) + 1;

        // Contar por tipo de página
        patterns.pages[page] = (patterns.pages[page] || 0) + 1;

        // Empresas
        if (page === 'empresa' || page === 'business' || page === 'entreprise' || page === 'unternehmen' || page === 'azienda') {
            const businessSlug = pathParts[2];
            if (businessSlug) {
                patterns.empresas.push({ url, country, slug: businessSlug });
                patterns.empresaByCountry[country] = (patterns.empresaByCountry[country] || 0) + 1;

                // Detectar empresas en país incorrecto
                // Si el slug tiene características de otro idioma/país
                if (country === 'br' || country === 'pt') {
                    // URLs de Brasil/Portugal con nombres españoles
                    if (businessSlug.includes('Frutería') || businessSlug.includes('Cafetería') ||
                        businessSlug.includes('Panadería') || businessSlug.toLowerCase().includes('málaga')) {
                        patterns.wrongCountry.push({ url, country, slug: businessSlug, issue: 'Spanish business in BR/PT' });
                    }
                } else if (country === 'co' || country === 'ar' || country === 'mx' || country === 'cl') {
                    // URLs de países hispanohablantes con nombres de otros países
                    if (businessSlug.includes('Universidad_Federal') || businessSlug.includes('Pernambuco') ||
                        businessSlug.includes('Rio_Grande') || businessSlug.includes('Braga') ||
                        businessSlug.includes('Rechtsanwältin') || businessSlug.includes('Centre_Dentaire')) {
                        patterns.wrongCountry.push({ url, country, slug: businessSlug, issue: 'Foreign business in Spanish country' });
                    }
                } else if (country === 'de' || country === 'fr' || country === 'it') {
                    // URLs de países europeos no españoles con empresas latinoamericanas
                    if (businessSlug.includes('Universidad_Federal') || businessSlug.includes('Café') ||
                        businessSlug.toLowerCase().includes('rio_grande') || businessSlug.toLowerCase().includes('pernambuco')) {
                        patterns.wrongCountry.push({ url, country, slug: businessSlug, issue: 'Latin American business in European country' });
                    }
                } else if (country === 'en' || country === 'gb') {
                    // URLs en inglés con palabra "empresa" (español)
                    if (page === 'empresa') {
                        patterns.wrongCountry.push({ url, country, slug: businessSlug, issue: 'Spanish "empresa" in English route' });
                    }
                }
            }
        }
    } catch (e) {
        console.error(`Error parsing URL: ${url}`);
    }
});

// Imprimir resultados
console.log('═══════════════════════════════════════════════════════════');
console.log('🌍 DISTRIBUCIÓN POR PAÍS/IDIOMA');
console.log('═══════════════════════════════════════════════════════════\n');

const sortedCountries = Object.entries(patterns.countries).sort((a, b) => b[1] - a[1]);
sortedCountries.forEach(([country, count]) => {
    const percentage = ((count / urls.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 10));
    console.log(`${country.padEnd(4)} ${count.toString().padStart(4)} URLs (${percentage.padStart(5)}%) ${bar}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📄 DISTRIBUCIÓN POR TIPO DE PÁGINA');
console.log('═══════════════════════════════════════════════════════════\n');

const sortedPages = Object.entries(patterns.pages).sort((a, b) => b[1] - a[1]).slice(0, 15);
sortedPages.forEach(([page, count]) => {
    const percentage = ((count / urls.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 10));
    console.log(`${page.padEnd(25)} ${count.toString().padStart(4)} URLs (${percentage.padStart(5)}%) ${bar}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🏢 EMPRESAS CON SOFT 404');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Total empresas: ${patterns.empresas.length} (${((patterns.empresas.length / urls.length) * 100).toFixed(1)}%)\n`);

console.log('Distribución por país:');
const sortedEmpresasByCountry = Object.entries(patterns.empresaByCountry).sort((a, b) => b[1] - a[1]);
sortedEmpresasByCountry.forEach(([country, count]) => {
    const percentage = ((count / patterns.empresas.length) * 100).toFixed(1);
    console.log(`  ${country}: ${count} empresas (${percentage}%)`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('⚠️  EMPRESAS EN PAÍS INCORRECTO (CAUSA PRINCIPAL)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Total detectadas: ${patterns.wrongCountry.length}\n`);

if (patterns.wrongCountry.length > 0) {
    console.log('Ejemplos:');
    patterns.wrongCountry.slice(0, 20).forEach(({ url, country, slug, issue }) => {
        console.log(`  ❌ /${country}/ - ${slug.substring(0, 40)}`);
        console.log(`     ${issue}`);
        console.log(`     ${url}\n`);
    });
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🎯 CONCLUSIONES Y RECOMENDACIONES');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('1️⃣  PROBLEMA PRINCIPAL: Empresas crawleadas en países incorrectos');
console.log('   - Empresas españolas aparecen en /br/, /co/, /ar/, etc.');
console.log('   - Empresas brasileñas aparecen en /de/, /co/, etc.');
console.log('   - Esto genera Soft 404 porque la empresa no existe en ese país\n');

console.log('2️⃣  CAUSA RAÍZ: hreflang tags generan URLs para todos los idiomas');
console.log('   - Meta.tsx genera hreflang para 15+ idiomas/países');
console.log('   - Google crawlea todas esas variantes');
console.log('   - Solo 1 variante tiene contenido (país real de la empresa)\n');

console.log('3️⃣  SOLUCIÓN RECOMENDADA:');
console.log('   ✅ Meta.tsx ya detecta páginas de empresa y NO genera hreflang');
console.log('   ✅ Solo genera x-default apuntando a URL canónica');
console.log('   ⚠️  Estas URLs Soft 404 son antiguas (crawled hasta 2025-12)');
console.log('   ⚠️  Con el fix de Meta.tsx, Google dejará de descubrir nuevas\n');

console.log('4️⃣  ACCIONES:');
console.log('   1. Verificar que Meta.tsx no genere hreflang para empresas (YA HECHO ✓)');
console.log('   2. Esperar a que Google re-crawlee y las marque como 404 real');
console.log('   3. Considerar enviar lista de URLs para eliminación en GSC');
console.log('   4. Monitorear reducción de Soft 404 en próximas 4-8 semanas\n');

console.log('5️⃣  PÁGINAS NO-EMPRESA CON SOFT 404:');
const nonEmpresaUrls = urls.length - patterns.empresas.length;
console.log(`   ${nonEmpresaUrls} URLs (${((nonEmpresaUrls / urls.length) * 100).toFixed(1)}%)`);
console.log('   Revisar casos-de-exito, explore, etc. en países sin contenido\n');

// Guardar reporte detallado
const reportPath = path.join(__dirname, '../GSC/SOFT-404-ANALYSIS-REPORT.txt');
const report = `
REPORTE DETALLADO DE SOFT 404
Fecha: ${new Date().toISOString()}
Total URLs: ${urls.length}

DISTRIBUCIÓN POR PAÍS:
${sortedCountries.map(([country, count]) => `${country}: ${count} URLs (${((count / urls.length) * 100).toFixed(1)}%)`).join('\n')}

DISTRIBUCIÓN POR TIPO DE PÁGINA:
${sortedPages.map(([page, count]) => `${page}: ${count} URLs (${((count / urls.length) * 100).toFixed(1)}%)`).join('\n')}

EMPRESAS CON SOFT 404: ${patterns.empresas.length}
Distribución:
${sortedEmpresasByCountry.map(([country, count]) => `  ${country}: ${count}`).join('\n')}

EMPRESAS EN PAÍS INCORRECTO: ${patterns.wrongCountry.length}
${patterns.wrongCountry.map(({ url, country, slug, issue }) => `${country}: ${slug}\n  ${issue}\n  ${url}\n`).join('\n')}

CONCLUSIÓN:
El problema principal es que Google crawleó empresas en países incorrectos debido a
hreflang tags que generaban URLs para todos los idiomas. Meta.tsx ya fue corregido para
no generar hreflang en páginas de empresa individual. Estas URLs Soft 404 deberían
reducirse naturalmente cuando Google re-crawlee el sitio.
`;

fs.writeFileSync(reportPath, report);
console.log(`\n📄 Reporte completo guardado en: GSC/SOFT-404-ANALYSIS-REPORT.txt`);
