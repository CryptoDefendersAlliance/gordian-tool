// const query = `MATCH (:Address)-[:TX_TO]-(p)
//                RETURN [(p)-[:TX_TO]-(m) | m][..5] as txs`;
const neo4j = window.neo4j.v1;
const driver = neo4j.driver('bolt://gordian.stop-thieves.org:7687', neo4j.auth.basic('guest', 'guest'));

export function loadTxsByAddress(address) {
    const session = driver.session();
    const query = `MATCH (a:Address)-[tx:TX_TO]->(b:Address)
                   WHERE a.hash="${address}"
                   RETURN a.hash AS fromAddress, collect({hash: tx.hash, timestamp: tx.timestamp, value: tx.value, toAddress: b.hash}) AS txs
                   LIMIT 10`;

    return session.run(query).then(result => {
        session.close();

        if (!result.records || result.size == 0)
            return null;
        return result.records;
    })
        .catch(error => {
            session.close();
            throw error;
        });
}

export function convertTxsToGraphData(records) {
    const nodes = [];
    const rels = [];
    records.forEach(record => {
        const fromAddress = record.get(0);

        nodes.push({ id: fromAddress });

        const txs = record.get('txs');
        txs.forEach(tx => {
            const node = nodes.find(node => node.id == tx.toAddress)
            const isNodeExists = Boolean(node);
            if (!isNodeExists)
                nodes.push({ id: tx.toAddress });
            rels.push({ source: fromAddress, target: tx.toAddress, ...tx });
        });
    });
    return { nodes: nodes, links: rels };
}
