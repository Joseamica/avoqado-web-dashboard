/**
 * Mexican Entity Types
 *
 * Legal entity types for Mexican businesses.
 * i18n keys reference src/locales/{lang}/setup.json
 */

export interface EntitySubType {
  value: string
  labelKey: string
}

export interface EntityType {
  value: string
  labelKey: string
  descriptionKey: string
  subTypes: EntitySubType[]
}

export const ENTITY_TYPES: EntityType[] = [
  {
    value: 'PERSONA_FISICA',
    labelKey: 'setup:entityType.personaFisica',
    descriptionKey: 'setup:entityType.personaFisicaDesc',
    subTypes: [
      {
        value: 'PERSONA_FISICA_ACTIVIDAD_EMPRESARIAL',
        labelKey: 'setup:entityType.subTypes.actividadEmpresarial',
      },
    ],
  },
  {
    value: 'PERSONA_MORAL',
    labelKey: 'setup:entityType.personaMoral',
    descriptionKey: 'setup:entityType.personaMoralDesc',
    subTypes: [
      { value: 'SA_DE_CV', labelKey: 'setup:entityType.subTypes.saDeCV' },
      { value: 'S_DE_RL_DE_CV', labelKey: 'setup:entityType.subTypes.sDeRLDeCV' },
      { value: 'SC', labelKey: 'setup:entityType.subTypes.sc' },
      { value: 'AC', labelKey: 'setup:entityType.subTypes.ac' },
      { value: 'SAPI_DE_CV', labelKey: 'setup:entityType.subTypes.sapiDeCV' },
      { value: 'SAS', labelKey: 'setup:entityType.subTypes.sas' },
    ],
  },
]

/** Flat list of all entity sub-types for selection */
export const ALL_ENTITY_OPTIONS = ENTITY_TYPES.flatMap(entity => [
  // If it has no sub-types, the entity itself is the option
  ...(entity.subTypes.length === 0
    ? [{ value: entity.value, labelKey: entity.labelKey, parentValue: entity.value }]
    : []),
  // Sub-types
  ...entity.subTypes.map(sub => ({
    value: sub.value,
    labelKey: sub.labelKey,
    parentValue: entity.value,
  })),
])
