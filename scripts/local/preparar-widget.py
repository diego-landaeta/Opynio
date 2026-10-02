"""Prepara el banco de pruebas del widget incrustado.

Genera dos ficheros (ambos ignorados por git):

  - `widget-local.js`: copia de `public/widget.js` apuntando al Supabase local.
    Solo cambia tres constantes (la URL de la función, la clave anónima y la URL
    pública); el resto es idéntico al que se sirve a los clientes, que es lo que
    hace válida la prueba.
  - `ids.js`: identificadores de la empresa y de un producto de ejemplo. Cambian
    en cada reconstrucción de la base, así que no pueden ir escritos en la página.

Uso:

    bash scripts/local/reconstruir.sh
    python scripts/local/preparar-widget.py
    npx vite --mode docker --port 8768
    # abrir http://localhost:8768/scripts/local/web-cliente.html
"""
import io
import json
import os
import re
import sys
import urllib.request

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORIGEN = os.path.join(RAIZ, 'public', 'widget.js')
DESTINO = os.path.join(RAIZ, 'scripts', 'local', 'widget-local.js')
IDS = os.path.join(RAIZ, 'scripts', 'local', 'ids.js')
ENTORNO = os.path.join(RAIZ, '.env.docker.local')
BASE_LOCAL = os.environ.get('OPYNIO_BASE_LOCAL', 'http://localhost:8768')


def leer_entorno():
    if not os.path.exists(ENTORNO):
        sys.exit('Falta .env.docker.local. Ejecuta antes: bash scripts/local/reconstruir.sh')
    valores = {}
    for linea in io.open(ENTORNO, encoding='utf-8'):
        if '=' in linea and not linea.lstrip().startswith('#'):
            clave, _, valor = linea.partition('=')
            valores[clave.strip()] = valor.strip()
    return valores['VITE_SUPABASE_URL'], valores['VITE_SUPABASE_ANON_KEY']


def copiar_widget(url, anon):
    s = io.open(ORIGEN, encoding='utf-8').read()

    s, n1 = re.subn(r"var API_URL = '[^']+';",
                    "var API_URL = '" + url + "/functions/v1/widget-proxy';", s, count=1)
    s, n2 = re.subn(r"var API_KEY = '[^']+';",
                    "var API_KEY = '" + anon + "';", s, count=1)
    s, n3 = re.subn(r"var BASE_URL = '[^']+';",
                    "var BASE_URL = '" + BASE_LOCAL + "';", s, count=1)

    if not (n1 and n2 and n3):
        sys.exit('No se encontraron las tres constantes en public/widget.js '
                 '(API_URL=%d, API_KEY=%d, BASE_URL=%d). Revisa si cambiaron de nombre.'
                 % (n1, n2, n3))

    io.open(DESTINO, 'w', encoding='utf-8', newline='\n').write(s)
    print('widget-local.js listo, apuntando a ' + url)


def escribir_ids(url, anon):
    def consultar(ruta):
        peticion = urllib.request.Request(
            url + '/rest/v1/' + ruta,
            headers={'apikey': anon, 'Authorization': 'Bearer ' + anon})
        return json.loads(urllib.request.urlopen(peticion, timeout=15).read().decode())

    empresas = consultar('businesses?select=id,name&slug=eq.academia-local&limit=1')
    if not empresas:
        sys.exit('No hay datos locales. Ejecuta antes: bash scripts/local/reconstruir.sh')
    empresa = empresas[0]

    productos = consultar('review_subjects?select=id,name&business_id=eq.'
                          + empresa['id'] + '&is_active=eq.true&limit=1')
    if not productos:
        sys.exit('La empresa local no tiene productos activos.')
    producto = productos[0]

    io.open(IDS, 'w', encoding='utf-8', newline='\n').write(
        '// Generado por preparar-widget.py. No editar a mano.\n'
        'window.OPYNIO_LOCAL = '
        + json.dumps({'businessId': empresa['id'],
                      'productId': producto['id'],
                      'businessName': empresa['name'],
                      'productName': producto['name']},
                     ensure_ascii=False, indent=2)
        + ';\n')
    print('ids.js listo: ' + empresa['name'] + ' / ' + producto['name'])


def main():
    url, anon = leer_entorno()
    copiar_widget(url, anon)
    escribir_ids(url, anon)


if __name__ == '__main__':
    main()
