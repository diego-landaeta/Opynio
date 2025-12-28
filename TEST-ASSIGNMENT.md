# Test: Asignación de Empresa a Usuario

## Instrucciones para Recopilar Información de Debugging

### Paso 1: Limpiar la Consola
1. Abre las DevTools (F12)
2. Ve a la pestaña "Console"
3. Haz clic derecho → "Clear console" o presiona Ctrl+L
4. Marca la opción "Preserve log" (para mantener los logs aunque se recargue la página)

### Paso 2: Filtrar Solo Nuestros Logs
En el campo de filtro de la consola, escribe:
```
🔧 OR 📊 OR 👤 OR ✅ OR ❌ OR 🔔 OR 👔 OR 🔍
```

O simplemente busca por:
```
updateUserRole OR getBusinessesForOwner OR Business
```

### Paso 3: Intentar Asignar la Empresa
1. Como admin, ve a `/admin/usuarios`
2. Selecciona el usuario "Angel"
3. Cambia el rol a "business_owner"
4. Ingresa "Test Company" como nombre de empresa
5. Haz clic en "Guardar"

### Paso 4: Copiar TODOS los Logs

Copia y pega TODOS los mensajes que aparezcan en la consola, especialmente:
- Los que empiezan con 🔧, 📊, 👤, ✅, ❌
- Los errores en rojo
- Cualquier advertencia en amarillo relacionada con "business" o "supabase"

### Paso 5: Verificar en la Base de Datos

Necesitamos verificar si la empresa se creó en Supabase:

1. Ve a tu Supabase Dashboard
2. Ve a "Table Editor"
3. Abre la tabla "businesses"
4. Busca si existe una empresa con el nombre que ingresaste
5. Verifica el campo "owner_id" - debe coincidir con el ID del usuario "Angel"

También verifica la tabla "profiles":
1. Abre la tabla "profiles"
2. Busca al usuario "Angel"
3. Verifica que su campo "role" sea "business_owner"

## Información que Necesito

Por favor proporciona:

1. **Logs de la consola** (copia y pega todo)
2. **¿Se creó la empresa en la tabla `businesses`?** (sí/no)
3. **¿El rol cambió a `business_owner` en la tabla `profiles`?** (sí/no)
4. **¿Cuál es el `owner_id` de la empresa creada?**
5. **¿Cuál es el `id` del usuario "Angel"?**

## Script de Verificación Manual

Si quieres verificar manualmente en la consola del navegador, ejecuta este código:

```javascript
// Pega esto en la consola del navegador mientras estés logueado como Angel
(async () => {
  const { createClient } = supabase;
  const supabaseUrl = 'TU_SUPABASE_URL';
  const supabaseKey = 'TU_SUPABASE_ANON_KEY';
  const client = createClient(supabaseUrl, supabaseKey);

  // Obtener usuario actual
  const { data: { user } } = await client.auth.getUser();
  console.log('👤 Usuario actual:', user);

  // Obtener perfil
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  console.log('📋 Perfil:', profile);
  console.log('❌ Error perfil:', profileError);

  // Obtener empresas
  const { data: businesses, error: businessError } = await client
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id);
  console.log('🏢 Empresas:', businesses);
  console.log('❌ Error empresas:', businessError);
})();
```

## Posibles Problemas que Estamos Buscando

### 1. Políticas RLS Bloqueando la Creación
**Síntoma**: Verás un error `❌ Error creating business` con un código de error relacionado con permisos.

**Solución**: Necesitaremos ajustar las políticas RLS en Supabase.

### 2. Políticas RLS Bloqueando la Lectura
**Síntoma**: La empresa se crea (puedes verla en Supabase Dashboard) pero `getBusinessesForOwner` retorna `[]`.

**Solución**: Necesitaremos agregar una política de lectura para usuarios business_owner.

### 3. El owner_id No Coincide
**Síntoma**: La empresa se crea con un `owner_id` diferente al `id` del usuario.

**Solución**: Hay un problema con cómo se está pasando el `userId` a la función.

### 4. Realtime No Está Habilitado
**Síntoma**: No ves los logs con 🔔 en la consola.

**Solución**: Habilitar Realtime en Supabase para las tablas `profiles` y `businesses`.

### 5. El Usuario No Tiene Sesión Activa
**Síntoma**: El usuario "Angel" no ve ningún cambio automáticamente.

**Solución**: El usuario debe cerrar sesión y volver a iniciarla.
