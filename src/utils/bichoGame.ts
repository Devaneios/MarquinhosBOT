const animals = [
    "Easter egg",
    "Avestruz",
    "Águia",
    "Burro",
    "Borboleta",
    "Cachorro",
    "Cabra",
    "Carneiro",
    "Camelo",
    "Cobra",
    "Coelho",
    "Cavalo",
    "Elefante",
    "Galo",
    "Gato",
    "Jacaré",
    "Leão",
    "Macaco",
    "Porco",
    "Pavão",
    "Peru",
    "Touro",
    "Tigre",
    "Urso",
    "Veado",
    "Vaca",
];

const males = [
    1,
    3,
    5,
    7,
    8,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
];

export function getBicho() {
    const randint = Math.floor(Math.random() * 99) + 1;
    const randCeil = Math.ceil(randint / 4);
    // Male animal (portuguese)
    if (males.includes(randCeil)) {
        return `no ${animals[randCeil]} ${randint}`;
    }
    // Female animal (portuguese)
    return `na ${animals[randCeil]} ${randint}`;
}