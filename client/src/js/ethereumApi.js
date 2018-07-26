export function loadAddressBasicInfo(address) {
    const url = `https://api.ethplorer.io/getAddressInfo/${address}`;

    return $.ajax({
        url: url,
        method: 'GET',
        data: {
            apiKey: 'freekey'
        }
    });
}
