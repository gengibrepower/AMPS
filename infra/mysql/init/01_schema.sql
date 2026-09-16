-- =============================================
-- AMPS - Automated Management Parking System
-- Banco de Dados: parking_system
--
-- Duas unidades convivem, de proposito:
--   modelos.*_mm  -> milimetros inteiros (dado de catalogo, comparacao exata)
--   topologias.grafo -> METROS, porque o vies por tamanho do Merlian tem
--   baselineWidth 1.85 e baselineLength 4.5 hardcoded. Grafo em mm quebra a RN-14.
-- A conversao acontece no adapter, ao montar vehicle.dimensions.
-- =============================================

CREATE DATABASE IF NOT EXISTS parking_system;
USE parking_system;

-- ---------------------------------------------
-- Tabela: usuarios
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nome         VARCHAR(150)                          NOT NULL,
    email        VARCHAR(150)                          NOT NULL UNIQUE,
    cpf          VARCHAR(14)                           NOT NULL UNIQUE,
    senha        VARCHAR(255)                          NOT NULL,
    tipo_conta   ENUM('common_user', 'dono', 'p_admin') NOT NULL DEFAULT 'common_user',
    data_criacao TIMESTAMP                             DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Tabela: donos
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS donos (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT                                   NOT NULL UNIQUE,
    razao        VARCHAR(255)                          NOT NULL,
    cnpj         VARCHAR(20)                           NOT NULL UNIQUE,
    status       ENUM('ativo', 'inativo')              NOT NULL DEFAULT 'ativo',
    data_criacao TIMESTAMP                             DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Tabela: estacionamentos
-- Sem quantidade_vagas: o numero de vagas e derivado do layout (RN-03).
-- publicado sustenta a RN-05 / RF-04 / RF-16.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS estacionamentos (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    dono_id              INT            NOT NULL,
    nome_estacionamento  VARCHAR(150)   NOT NULL,
    publicado            BOOLEAN        NOT NULL DEFAULT FALSE,
    nome_blocos          VARCHAR(255),
    cep                  VARCHAR(10),
    numero               VARCHAR(20),
    logradouro           VARCHAR(255),
    bairro               VARCHAR(100),
    complemento          VARCHAR(255),
    cidade               VARCHAR(100),
    estado               CHAR(2),
    data_criacao         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dono_id) REFERENCES donos(id)
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Tabela: modelos
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS modelos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    marca          VARCHAR(100)      NOT NULL,
    nome           VARCHAR(100)      NOT NULL,
    largura_mm     SMALLINT UNSIGNED NOT NULL,
    comprimento_mm SMALLINT UNSIGNED NOT NULL,
    data_criacao   TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (marca, nome)
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Tabela: carros
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS carros (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    placa        VARCHAR(20)                           NOT NULL UNIQUE,
    proprietario VARCHAR(150)                          NOT NULL,
    modelo_id    INT                                   NOT NULL,
    data_criacao TIMESTAMP                             DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modelo_id) REFERENCES modelos(id)
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Tabela: topologias
-- Um grafo por estacionamento, guardado EXATAMENTE na forma que o Merlian
-- aceita em POST /v1/recommendations: { nodes, edges }, role sendo
-- candidate | attractor | source | transit. Mandar para o Merlian e
-- SELECT grafo, sem transformar.
--
-- O JSON_SCHEMA_VALID replica o z.strictObject do Merlian, additionalProperties
-- incluso: um grafo que ele recusaria na requisicao nem entra no banco.
-- O que o schema NAO alcanca, e por isso vive na aplicacao:
--   - from/to apontarem para nos existentes
--   - ids de no serem unicos dentro do grafo
--   - candidate obrigar dimensions (JSON Schema draft-4 nao tem if/then)
--
-- versao vira o graphVersion das requisicoes do Merlian.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS topologias (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    estacionamento_id INT          NOT NULL UNIQUE,
    versao            INT UNSIGNED NOT NULL DEFAULT 1,
    grafo             JSON         NOT NULL,
    atualizado_em     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (estacionamento_id) REFERENCES estacionamentos(id) ON DELETE CASCADE,
    CONSTRAINT grafo_no_formato_do_merlian
        CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["nodes","edges"],"properties":{"nodes":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","role","position"],"properties":{"id":{"type":"string","minLength":1},"label":{"type":"string"},"role":{"enum":["candidate","attractor","source","transit"]},"position":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number"},"y":{"type":"number"}}},"dimensions":{"type":"object","additionalProperties":false,"required":["width","length"],"properties":{"width":{"type":"number","minimum":0,"exclusiveMinimum":true},"length":{"type":"number","minimum":0,"exclusiveMinimum":true}}}}}},"edges":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["from","to","weight"],"properties":{"from":{"type":"string","minLength":1},"to":{"type":"string","minLength":1},"weight":{"type":"number","minimum":0}}}}}}', grafo))
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Tabela: vagas
-- O que o mapa e a operacao precisam alem do grafo. Casada com o no pelo
-- no_id, que e o node.id de dentro do JSON — o banco nao consegue garantir
-- essa ligacao, ela e responsabilidade de quem grava.
--
-- rotacao_graus existe porque o contrato do Merlian nao tem orientacao, e
-- sem ela o mapa nao consegue desenhar a vaga na inclinacao certa.
-- status cobre a RN-17: ocupada e reservada sao ambas indisponiveis.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS vagas (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    estacionamento_id INT              NOT NULL,
    no_id             VARCHAR(50)      NOT NULL,
    numero            VARCHAR(20)      NOT NULL,
    tipo              ENUM('comum', 'pcd', 'idoso', 'moto', 'eletrico') NOT NULL DEFAULT 'comum',
    rotacao_graus     SMALLINT         NOT NULL DEFAULT 0,
    sensor            VARCHAR(50)      NULL,
    status            ENUM('livre', 'ocupada', 'reservada') NOT NULL DEFAULT 'livre',
    carro_id          INT              NULL,
    data_criacao      TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (estacionamento_id, no_id),
    UNIQUE (estacionamento_id, numero),
    FOREIGN KEY (estacionamento_id) REFERENCES estacionamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (carro_id) REFERENCES carros(id),
    CONSTRAINT vaga_livre_nao_tem_carro
        CHECK (status <> 'livre' OR carro_id IS NULL),
    CONSTRAINT rotacao_em_graus
        CHECK (rotacao_graus >= 0 AND rotacao_graus < 360)
) ENGINE=InnoDB;
