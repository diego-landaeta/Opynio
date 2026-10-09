// Contenido de las paginas legales (privacidad y cookies, aviso legal y
// terminos de uso). Un fichero por idioma en ./content/, todos con esta forma.
//
// Los textos pueden llevar marcadores que se sustituyen al pintar:
//   enlaces:  {contacto} {soporte} {privacidad} {terminos} {avisoLegal}
//   titular:  {titular} {nif} {domicilio} {registro} {email} {web}
// Los marcadores se copian tal cual en cada traduccion; solo cambia el texto
// de alrededor. Los datos del titular viven en ../titular.ts (uno para todos).

export type Seccion = {
    /** Titulo de la seccion. */
    t: string;
    /** Parrafo opcional que va antes de la lista. */
    intro?: string;
    /** Un parrafo (si solo hay uno) o los puntos de una lista. Un punto con
     *  {registro} se omite si el titular no tiene datos registrales. */
    p: string[];
};

export type DocLegal = {
    titulo: string;
    /** Meta description de la pagina. */
    meta: string;
    secciones: Seccion[];
};

export type DocPrivacidad = DocLegal & {
    cookies: {
        t: string;
        intro: string;
        /** [tipo, descripcion] por fila de la tabla. */
        filas: [string, string][];
        /** Texto del boton que abre los ajustes de cookies. */
        boton: string;
    };
};

export type LegalContent = {
    /** «Última actualización». */
    actualizado: string;
    /** Aviso de traduccion informativa; vacio en español (es la version que prevalece). */
    nota: string;
    /** Texto visible de cada enlace que sustituye a su marcador. */
    enlaces: {
        contacto: string;
        soporte: string;
        privacidad: string;
        terminos: string;
        avisoLegal: string;
    };
    privacidad: DocPrivacidad;
    avisoLegal: DocLegal;
    terminos: DocLegal;
};
