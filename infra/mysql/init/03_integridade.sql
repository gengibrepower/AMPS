-- =============================================
-- Integridade do grafo em JSON
--
-- A CHECK JSON_SCHEMA_VALID de 01_schema.sql garante a FORMA do grafo (a mesma
-- que o z.strictObject do Merlian exige). O que ela nao alcanca e integridade
-- referencial DENTRO do documento, porque JSON Schema nao cruza elementos de
-- array. Isso e o que estes triggers cobrem:
--
--   - aresta apontando para no que nao existe no grafo
--   - dois nos com o mesmo id
--   - candidate sem dimensions (o Merlian exige; draft-4 nao tem if/then)
--   - vagas.no_id apontando para no inexistente ou que nao e candidate
--   - update do grafo removendo no que ainda tem vaga
--
-- Custo: a topologia tem que ser gravada ANTES das vagas do estacionamento.
-- Os erros chegam como SQLSTATE 45000; o adapter traduz para HTTP.
-- =============================================

USE parking_system;

DROP PROCEDURE IF EXISTS valida_grafo;
DROP TRIGGER   IF EXISTS topologias_valida_insert;
DROP TRIGGER   IF EXISTS topologias_valida_update;
DROP TRIGGER   IF EXISTS vagas_valida_no_insert;
DROP TRIGGER   IF EXISTS vagas_valida_no_update;

DELIMITER //

CREATE PROCEDURE valida_grafo(g JSON)
BEGIN
    DECLARE n INT;

    SELECT COUNT(*) INTO n FROM (
        SELECT id FROM JSON_TABLE(g, '$.nodes[*]' COLUMNS (id VARCHAR(50) PATH '$.id')) t
        GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'grafo: ha ids de no repetidos';
    END IF;

    SELECT COUNT(*) INTO n
    FROM JSON_TABLE(g, '$.edges[*]' COLUMNS (
            origem  VARCHAR(50) PATH '$.from',
            destino VARCHAR(50) PATH '$.to')) e
    WHERE e.origem  NOT IN (SELECT id FROM JSON_TABLE(g, '$.nodes[*]' COLUMNS (id VARCHAR(50) PATH '$.id')) a)
       OR e.destino NOT IN (SELECT id FROM JSON_TABLE(g, '$.nodes[*]' COLUMNS (id VARCHAR(50) PATH '$.id')) b);
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'grafo: aresta aponta para no inexistente';
    END IF;

    SELECT COUNT(*) INTO n
    FROM JSON_TABLE(g, '$.nodes[*]' COLUMNS (
            role    VARCHAR(20) PATH '$.role',
            largura DOUBLE      PATH '$.dimensions.width')) c
    WHERE c.role = 'candidate' AND c.largura IS NULL;
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'grafo: candidate sem dimensions';
    END IF;
END //

CREATE PROCEDURE exige_candidate(est INT, no VARCHAR(50))
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM topologias t,
             JSON_TABLE(t.grafo, '$.nodes[*]' COLUMNS (
                 id   VARCHAR(50) PATH '$.id',
                 role VARCHAR(20) PATH '$.role')) n
        WHERE t.estacionamento_id = est AND n.id = no AND n.role = 'candidate'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'vaga: no_id nao e um candidate do grafo';
    END IF;
END //

CREATE TRIGGER topologias_valida_insert BEFORE INSERT ON topologias
FOR EACH ROW BEGIN CALL valida_grafo(NEW.grafo); END //

CREATE TRIGGER topologias_valida_update BEFORE UPDATE ON topologias
FOR EACH ROW
BEGIN
    DECLARE orfas INT;
    CALL valida_grafo(NEW.grafo);

    SELECT COUNT(*) INTO orfas FROM vagas v
    WHERE v.estacionamento_id = NEW.estacionamento_id
      AND v.no_id NOT IN (SELECT id FROM JSON_TABLE(NEW.grafo, '$.nodes[*]' COLUMNS (id VARCHAR(50) PATH '$.id')) n);
    IF orfas > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'grafo: remove no que ainda tem vaga';
    END IF;
END //

CREATE TRIGGER vagas_valida_no_insert BEFORE INSERT ON vagas
FOR EACH ROW BEGIN CALL exige_candidate(NEW.estacionamento_id, NEW.no_id); END //

CREATE TRIGGER vagas_valida_no_update BEFORE UPDATE ON vagas
FOR EACH ROW BEGIN CALL exige_candidate(NEW.estacionamento_id, NEW.no_id); END //

DELIMITER ;
