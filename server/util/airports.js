// Airport codes that big networks put in their server names (for2 = Fortaleza, gru3 = São Paulo...): the city a
// server really is in, better than where its address is registered. Only the cities such networks use.
export const AIRPORTS = {
    // Brazil
    gru: ["São Paulo", "BR", -23.55, -46.63], cgh: ["São Paulo", "BR", -23.55, -46.63], vcp: ["Campinas", "BR", -22.91, -47.06],
    gig: ["Rio de Janeiro", "BR", -22.91, -43.17], sdu: ["Rio de Janeiro", "BR", -22.91, -43.17],
    for: ["Fortaleza", "BR", -3.73, -38.53], ssa: ["Salvador", "BR", -12.97, -38.5], rec: ["Recife", "BR", -8.05, -34.88],
    bsb: ["Brasília", "BR", -15.79, -47.88], poa: ["Porto Alegre", "BR", -30.03, -51.23], cwb: ["Curitiba", "BR", -25.43, -49.27],
    cnf: ["Belo Horizonte", "BR", -19.92, -43.94], bel: ["Belém", "BR", -1.46, -48.5], mao: ["Manaus", "BR", -3.12, -60.02],
    nat: ["Natal", "BR", -5.79, -35.21], aju: ["Aracaju", "BR", -10.91, -37.07], fln: ["Florianópolis", "BR", -27.6, -48.55],
    gyn: ["Goiânia", "BR", -16.68, -49.25], vix: ["Vitória", "BR", -20.32, -40.34], jpa: ["João Pessoa", "BR", -7.12, -34.86],
    slz: ["São Luís", "BR", -2.53, -44.3], the: ["Teresina", "BR", -5.09, -42.8], mcz: ["Maceió", "BR", -9.67, -35.74],
    // Rest of Latin America
    eze: ["Buenos Aires", "AR", -34.6, -58.38], aep: ["Buenos Aires", "AR", -34.6, -58.38], scl: ["Santiago", "CL", -33.45, -70.67],
    lim: ["Lima", "PE", -12.05, -77.04], bog: ["Bogotá", "CO", 4.71, -74.07], mex: ["Mexico City", "MX", 19.43, -99.13],
    qro: ["Querétaro", "MX", 20.59, -100.39], uio: ["Quito", "EC", -0.18, -78.47], mvd: ["Montevideo", "UY", -34.9, -56.16],
    asu: ["Asunción", "PY", -25.26, -57.58], pty: ["Panama", "PA", 8.98, -79.52], sjo: ["San José", "CR", 9.93, -84.08],
    // North America
    mia: ["Miami", "US", 25.76, -80.19], iad: ["Ashburn", "US", 39.04, -77.49], atl: ["Atlanta", "US", 33.75, -84.39],
    dfw: ["Dallas", "US", 32.78, -96.8], ord: ["Chicago", "US", 41.88, -87.63], lax: ["Los Angeles", "US", 34.05, -118.24],
    sjc: ["San Jose", "US", 37.34, -121.89], sfo: ["San Francisco", "US", 37.77, -122.42], sea: ["Seattle", "US", 47.61, -122.33],
    jfk: ["New York", "US", 40.71, -74.01], ewr: ["Newark", "US", 40.74, -74.17], lga: ["New York", "US", 40.71, -74.01],
    bos: ["Boston", "US", 42.36, -71.06], den: ["Denver", "US", 39.74, -104.99], phx: ["Phoenix", "US", 33.45, -112.07],
    yyz: ["Toronto", "CA", 43.65, -79.38], yul: ["Montreal", "CA", 45.5, -73.57], yvr: ["Vancouver", "CA", 49.28, -123.12],
    // Europe and beyond
    lis: ["Lisbon", "PT", 38.72, -9.14], mad: ["Madrid", "ES", 40.42, -3.7], lhr: ["London", "GB", 51.51, -0.13],
    cdg: ["Paris", "FR", 48.86, 2.35], fra: ["Frankfurt", "DE", 50.11, 8.68], ams: ["Amsterdam", "NL", 52.37, 4.9],
    mrs: ["Marseille", "FR", 43.3, 5.37], mxp: ["Milan", "IT", 45.46, 9.19], arn: ["Stockholm", "SE", 59.33, 18.07],
    waw: ["Warsaw", "PL", 52.23, 21.01], jnb: ["Johannesburg", "ZA", -26.2, 28.05], nrt: ["Tokyo", "JP", 35.68, 139.69],
    sin: ["Singapore", "SG", 1.35, 103.82], hkg: ["Hong Kong", "HK", 22.32, 114.17], syd: ["Sydney", "AU", -33.87, 151.21]
};

// Looks for an airport code in a server name: a part like "for2", "gru3" or "gru06s32" (always with a number,
// so plain words like "the" or "for" are not taken for airports)
export const airportOf = (name) => {
    if (!name) return null;
    for (const part of name.toLowerCase().split(/[.\-]/)) {
        const match = /^([a-z]{3})\d+[a-z]?\d*$/.exec(part);
        if (match && AIRPORTS[match[1]]) {
            const [city, cc, lat, lon] = AIRPORTS[match[1]];
            return {city, cc, lat, lon, code: match[1].toUpperCase()};
        }
    }
    return null;
};
