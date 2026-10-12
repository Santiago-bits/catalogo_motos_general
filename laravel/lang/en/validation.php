<?php

/*
 * Sólo se pisan los mensajes que ve el panel al subir archivos; el resto
 * sale de los textos por defecto de Laravel (se combinan solos).
 */
return [
    'uploaded' => 'El archivo no se pudo subir: supera el tamaño máximo que acepta el servidor ('.ini_get('upload_max_filesize').'). Probá con un archivo más liviano.',
    'max' => [
        'file' => 'El archivo no puede pesar más de :max KB.',
    ],
    'mimes' => 'El archivo tiene que ser de tipo: :values.',
    'image' => 'El archivo tiene que ser una imagen (JPG, PNG o WEBP).',
];
