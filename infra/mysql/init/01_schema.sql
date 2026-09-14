CREATE DATABASE IF NOT EXISTS parking_system;
USE parking_system;

CREATE TABLE IF NOT EXISTS usuarios (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nome         VARCHAR(150)                          NOT NULL,
    email        VARCHAR(150)                          NOT NULL UNIQUE,
    cpf          VARCHAR(14)                           NOT NULL UNIQUE,
    senha        VARCHAR(255)                          NOT NULL,
    tipo_conta   ENUM('common_user','dono','p_admin')  NOT NULL DEFAULT 'common_user',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS donos (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT          NOT NULL UNIQUE,
    razao        VARCHAR(255) NOT NULL,
    cnpj         VARCHAR(20)  NOT NULL UNIQUE,
    status       ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS modelos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    marca          VARCHAR(100)      NOT NULL,
    nome           VARCHAR(100)      NOT NULL,
    largura_mm     SMALLINT UNSIGNED NOT NULL,
    comprimento_mm SMALLINT UNSIGNED NOT NULL,
    data_criacao   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (marca, nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carros (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    placa        VARCHAR(20)  NOT NULL UNIQUE,
    proprietario VARCHAR(150) NOT NULL,
    modelo_id    INT          NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modelo_id) REFERENCES modelos(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estacionamentos (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    dono_estacionamento VARCHAR(20)  NOT NULL,
    nome_estacionamento VARCHAR(150) NOT NULL,
    quantidade_vagas    INT,
    nome_blocos         VARCHAR(255),
    cep                 VARCHAR(10),
    numero              VARCHAR(20),
    logradouro          VARCHAR(255),
    bairro              VARCHAR(100),
    complemento         VARCHAR(255),
    cidade              VARCHAR(100),
    estado              CHAR(2),
    data_criacao        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vagas (
    id_vaga             INT AUTO_INCREMENT PRIMARY KEY,
    vaga_estacionamento VARCHAR(20) NOT NULL,
    vaga_carro          VARCHAR(20) NULL,
    vaga_sensor         VARCHAR(50),
    vaga_numero         VARCHAR(20) NOT NULL,
    data_criacao        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
