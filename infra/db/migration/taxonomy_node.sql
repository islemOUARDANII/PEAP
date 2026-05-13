CREATE OR REPLACE VIEW public.rtmc_node AS
SELECT
    row_number() OVER (ORDER BY entity_type, code)::int AS id,
    entity_type::text AS taxonomy_type,
    code::text AS code,
    label::text AS label,
    lower(
        regexp_replace(
            translate(label, 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÇç',
                             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuCc'),
            '\s+',
            ' ',
            'g'
        )
    )::text AS normalized_label,
    source_table::text AS source_kind
FROM taxonomy.v_rtmc_mapper_entities
WHERE entity_type IN ('occupation', 'skill', 'activity');


CREATE OR REPLACE VIEW public.rtmc_appellation AS
SELECT
    row_number() OVER (ORDER BY code)::int AS id,
    code::text AS code_appellation,
    label::text AS libelle_appellation,
    lower(
        regexp_replace(
            translate(label, 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÇç',
                             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuCc'),
            '\s+',
            ' ',
            'g'
        )
    )::text AS normalized_label,
    occupation_code::text AS code_metier
FROM taxonomy.v_rtmc_mapper_entities
WHERE entity_type = 'appellation';