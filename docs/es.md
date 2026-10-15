# Calidad del agua

Esta integración muestra en Gladys la **calidad del agua del grifo** de su municipio francés y la
de las **zonas de baño** cercanas (playas, lagos y ríos vigilados), a partir de los resultados
del control sanitario que publica el Ministerio de Sanidad francés. Datos públicos, sin cuenta ni
clave.

> **Una información, no es un sistema de alerta sanitaria.** Los resultados se publican con varios
> días, a veces varias semanas de retraso. Si hay un problema con el agua del grifo o el baño está
> prohibido, prevalecen los avisos de su ayuntamiento, de su distribuidor de agua y de la ARS
> (agencia regional de salud). Sin afiliación con OFB / eaufrance ni con el Ministerio de Sanidad.

> **Desarrollada sin acceso a los servicios en directo** (la red de la sesión de desarrollo no
> los alcanzaba): se escribió y probó con respuestas grabadas y páginas reconstruidas. Sus
> comentarios son bienvenidos, sobre todo sobre el baño.

## Presentación

- **Un dispositivo «Agua del grifo · su municipio»**: la conformidad de la última muestra
  (bacteriológica y fisicoquímica), su fecha, la conclusión sanitaria redactada por la ARS y,
  cuando se miden, los **nitratos**, la **dureza** (útil para ajustar un descalcificador o un
  lavavajillas), el **cloro** y el **pH**.
- **Un dispositivo por zona de baño**: el resultado de la última muestra (bueno, medio, malo) o
  la prohibición de baño, su fecha y la temporada (abierta hasta…, cerrada).
- **Dos disparadores de escena**: «Agua del grifo no conforme» y «Baño desaconsejado o
  prohibido».
- **Un widget** para el panel y una acción **«Buscar zonas de baño»**.
- **Una lectura al día**: el ministerio publica los resultados del agua del grifo una vez al mes
  aproximadamente, y los del baño una vez por semana aproximadamente en temporada.

## Requisitos

- Gladys Assistant **5.2.0** o posterior.
- Acceso a Internet desde Gladys hacia `hubeau.eaufrance.fr`, `baignades.sante.gouv.fr` y
  `geo.api.gouv.fr`.
- Para usar su casa: su **ubicación** indicada en Gladys (Ajustes → Casas). La integración pide
  acceso a la ubicación de las casas (`location`), lo que se muestra al instalarla. Sin
  ubicación, escriba simplemente el código INSEE de su municipio.
- Municipios de la Francia metropolitana y de ultramar cubiertos por el control sanitario.

## Instalación y configuración

1. En Gladys, abra **Integraciones → Instalar desde GitHub** e introduzca
   `https://github.com/guim31/gladys-qualite-eau` (o instálela desde el catálogo cuando figure en
   él).
2. En la pestaña **Configuración**:
   - **Casa**: la casa cuya ubicación da el municipio. Vacío: la primera casa de Gladys que tiene
     ubicación.
   - **Municipios (códigos INSEE)**: solo para seguir otro municipio distinto del de la casa (una
     segunda residencia, el pueblo de sus padres…), hasta 5. Atención, el **código INSEE no es el
     código postal**: Orléans tiene el código postal 45000 pero el código INSEE 45234. Lo
     encontrará en el sitio del INSEE o en Wikipedia.
   - **Zonas de baño seguidas**: las de sus municipios (por defecto), las situadas a 5, 10 o
     20 km de su casa, o solo las que escriba.
   - **Zonas de baño**: códigos dados por «Buscar zonas de baño», o las direcciones de sus
     páginas en baignades.sante.gouv.fr.
   - **Idioma de los nombres y textos**: francés por defecto.
3. Guarde, abra la pestaña **Descubrir** y pulse **Añadir a Gladys** en los dispositivos que
   desee.

### Buscar zonas de baño

La acción **«Buscar zonas de baño»**, en la pestaña Configuración, enumera las zonas de un
municipio (escriba su código INSEE) o, con el campo vacío, las de los municipios alrededor de su
casa (5, 10 o 20 km), con su código. Copie los códigos que desee en **Zonas de baño** y guarde.

## Los dispositivos

### Agua del grifo

| Función                    | Lo que muestra                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Conformidad bacteriológica | Indicador de riesgo: verde (conforme), amarillo (conforme con excepción), rojo (no conforme)                       |
| Conformidad fisicoquímica  | Lo mismo, para los parámetros químicos (nitratos, pesticidas, metales…)                                            |
| Conclusión sanitaria       | El texto de la ARS para la última muestra, en francés                                                              |
| Última muestra             | La fecha de la última muestra publicada                                                                            |
| Nitratos (mg/L)            | El límite de calidad es de 50 mg/L                                                                                 |
| Dureza (°f)                | En grados franceses: menos de 15 °f, agua blanda; más de 30 °f, agua dura                                          |
| Cloro (mg/L)               | El cloro libre, o el cloro total si es el único medido; «<0,10» (bajo el umbral del laboratorio) se publica como 0 |
| pH                         | Entre 6,5 y 9 para un agua conforme                                                                                |

Cada conformidad procede de la **última muestra que la evaluó**: un control rutinario a menudo
solo busca bacterias, sin análisis químico. Las cifras son las más recientes de los dos últimos
años (la dureza se mide una vez al año o menos en los municipios pequeños). Gladys no tiene
unidad para mg/L ni para los grados franceses: estos valores se publican sin unidad y el nombre
de la función la indica.

Los parámetros del dispositivo indican el distribuidor (`DISTRIBUTOR`) y las redes de
distribución de la última muestra (`NETWORKS`).

### Zona de baño

| Función           | Lo que muestra                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Calidad del agua  | Indicador de riesgo: verde (bueno), amarillo (medio), naranja (malo), rojo (baño prohibido); nada fuera de temporada |
| Último resultado  | En palabras: Bueno, Medio, Malo, Baño prohibido, Fuera de temporada, Aún sin muestra, Resultado no publicado         |
| Última muestra    | La fecha del último resultado publicado                                                                              |
| Temporada de baño | «Abierta hasta el 31/08», «Cerrada (temporada del 15/06 al 31/08)», «Todo el año» en ultramar                        |

El resultado de una muestra (bueno, medio, malo) depende de las bacterias medidas (E. coli,
enterococos). No es la **clasificación** de fin de temporada (excelente, buena, suficiente,
insuficiente), calculada sobre cuatro años, que la integración no lee.

## Widget

El widget **Calidad del agua** muestra, sin ajustes, una línea por municipio (conforme o no, con
su dureza) y por zona de baño (último resultado y su fecha), en color, la dureza de su municipio
en grande y un título rojo cuando el agua del grifo no es conforme o se desaconseja un baño. Si
elige un dispositivo en sus ajustes, muestra su detalle: nitratos, dureza, cloro y pH en directo
y la conclusión sanitaria para un municipio; el resultado, la fecha y la temporada, con un
enlace a la ficha oficial, para una zona de baño.

## Disparadores de escena

- **Agua del grifo no conforme**: una nueva muestra de un municipio seguido supera un límite de
  calidad. Filtro: el municipio. Variables: nombre del municipio, fecha de la muestra, conclusión
  sanitaria, conformidad bacteriológica y fisicoquímica (`compliant`, `derogation`,
  `non_compliant`, `not_measured`). Se dispara una vez por muestra, nunca en la primera lectura
  ni para una muestra de más de 90 días.
- **Baño desaconsejado o prohibido**: una zona seguida recibe un mal resultado o una prohibición
  de baño. Filtros: la zona, el nuevo estado (`poor`, `prohibited`). Variables: nombre de la
  zona, estado, estado en palabras, fecha de la última muestra.

Para reaccionar a la vuelta a la normalidad, use el disparador nativo de Gladys «cambia el
estado de un dispositivo» sobre el indicador del dispositivo.

## Ejemplos de escenas

- **Alerta del agua del grifo**: disparador «Agua del grifo no conforme», acción «Enviar un
  mensaje» con las variables del disparador: «Agua del grifo no conforme en _nombre del
  municipio_ (muestra del _fecha_): _conclusión sanitaria_».
- **Antes de ir a la playa**: cada sábado a las 9, si el indicador «Calidad del agua» del lago es
  inferior a 2, enviar «Baño posible en el lago esta mañana».
- **Baño prohibido**: disparador «Baño desaconsejado o prohibido», estado «prohibido», acción
  «Enviar un mensaje» a toda la familia.
- **Descalcificador**: un gráfico de la dureza durante un año, para ajustar el descalcificador o
  el lavavajillas.

## Solución de problemas

- **Ningún dispositivo en la pestaña Descubrir**: la pantalla de configuración indica el motivo
  (casa sin ubicación, código INSEE desconocido…). Indique la ubicación de su casa o escriba un
  código INSEE.
- **«Ninguna muestra de agua del grifo publicada desde hace un año»**: compruebe que ha escrito
  el código INSEE y no el código postal. Para París, Lyon y Marsella, pruebe el código de toda la
  ciudad (75056, 69123, 13055) y luego el del distrito.
- **La última muestra tiene varias semanas**: es normal, los resultados se publican una vez al
  mes aproximadamente.
- **Una zona de baño sigue «Fuera de temporada» o «Aún sin muestra»**: la temporada no ha
  empezado o su primera muestra aún no se ha publicado.
- **«Hub'Eau no responde» o «baignades.sante.gouv.fr no responde»**: el servicio no está
  disponible; la integración lo vuelve a intentar cada hora y conserva los últimos valores.
- Para más detalles, ponga `LOG_LEVEL=debug`: cada lectura se escribe entonces en los registros
  de la integración (nunca la ubicación de su casa).

## Límites

- **A escala del municipio**: en una gran ciudad abastecida por varias redes, la última muestra
  puede proceder de otro barrio que el suyo (el parámetro `NETWORKS` lo indica).
- Los resultados llegan con retraso: de unos días a unas semanas para el agua del grifo. No es
  una alerta en tiempo real.
- El baño se lee en las páginas de baignades.sante.gouv.fr, que no tiene una API pública
  documentada: un cambio de esas páginas puede interrumpir la lectura hasta una actualización de
  la integración. La clasificación de fin de temporada no se lee.
- «Alrededor de mi casa» tiene en cuenta los municipios cuyo **centro** está dentro de la
  distancia, según geo.api.gouv.fr.
- 5 municipios y 10 zonas de baño como máximo.
- Ritmo y cuotas: ni Hub'Eau ni baignades.sante.gouv.fr publican una cuota; la integración hace
  cinco o seis pequeñas peticiones a Hub'Eau por municipio y por día, una petición por zona de baño y por día, y
  vuelve a pedir la lista de zonas y el municipio de la casa una vez por semana.
  geo.api.gouv.fr permite 50 peticiones por segundo.

## Fuentes y licencia

- Agua del grifo: [Hub'Eau – Calidad del agua potable](https://hubeau.eaufrance.fr/page/api-qualite-eau-potable),
  resultados del control sanitario del Ministerio de Sanidad, Licence Ouverte Etalab 2.0.
- Baño: [baignades.sante.gouv.fr](https://baignades.sante.gouv.fr), Ministerio de Sanidad y
  ARS.
- Municipios: [API Découpage administratif](https://geo.api.gouv.fr), Licence Ouverte Etalab
  2.0.
- La ubicación de su casa solo se envía a geo.api.gouv.fr, redondeada a unos 100 m, y no se
  guarda ni se escribe en los registros.
- Sin afiliación con OFB / eaufrance, el BRGM ni el Ministerio de Sanidad. Código bajo la
  licencia Apache 2.0.
