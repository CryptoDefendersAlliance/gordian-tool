import * as neo4jApi from './neo4jApi';

$(() => {
    $('#neo4j-address-search').submit(e => {
        e.preventDefault();
        const value = $('#neo4j-address-search').find('input').val();
        const isValid = isAddressValid(value);
        if (!isValid) return;
        loadTxsByAddress(value);
    });
});

function isAddressValid(address) {
    if (!address || address.length !== 42) return false;
    if (address.substr(0, 2) !== '0x') return false;

    return true;
}
function loadTxsByAddress(address) {
    const $graphEl = $('#neo4j-graph');
    $graphEl.html('Loading..').addClass('active');

    neo4jApi.loadTxsByAddress(address).then((txs => {
        $graphEl.html('');
        const graphData = neo4jApi.convertTxsToGraphData(txs);
        renderGraph(graphData);
    }));
}

function renderGraph(graph) {
    console.log(graph);
    let nodes = graph.nodes;
    let links = graph.links;

    const width = 1200;
    const height = 500;

    let svg = window.d3.select('#neo4j-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

        // .append('div').classed('d3-svg-container', true) // container class to make it responsive
        // .append('svg');
        // responsive SVG needs these 2 attributes and no width and height attr
        // .attr('preserveAspectRatio', 'xMinYMin meet')
        // .attr('viewBox', '0 0 600 400')
        // // class to make it responsive
        // .classed('d3-svg-content-responsive', true);


    let linkElements;
    let nodeElements;
    let textElements;

    // we use svg groups to logically group the elements together
    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    const textGroup = svg.append('g').attr('class', 'texts');

    // we use this reference to select/deselect
    // after clicking the same element twice
    let selectedId;

    // simulation setup with all forces
    const linkForce = d3
        .forceLink()
        .id(link => link.id)
        // .strength(link => link.strength);
        .strength(0.1);

    const simulation = d3
        .forceSimulation()
        .force('link', linkForce)
        .force('charge', d3.forceManyBody().strength(-320))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const dragDrop = d3.drag().on('start', node => {
        node.fx = node.x;
        node.fy = node.y;
    }).on('drag', node => {
        simulation.alphaTarget(0.7).restart();
        node.fx = d3.event.x;
        node.fy = d3.event.y;
    }).on('end', node => {
        if (!d3.event.active)
            simulation.alphaTarget(0);

        node.fx = null;
        node.fy = null;
    });


    /** ---------------------------
    --- UPDATE & INTERACTION ---
    ---------------------------**/

    // select node is called on every click
    // we either update the data according to the selection
    // or reset the data if the same node is clicked twice
    function onNodeClick(d) {
        // window.open(`https://etherscan.io/address/${d.id}`);
        loadTxsByAddress(d.id).then(txs => {

        });
    }

    function updateGraph() {
    // links
        linkElements = linkGroup.selectAll('line').data(links, link => link.target.id + link.source.id);
        linkElements.exit().remove();

        const linkEnter = linkElements.enter().append('line').attr('stroke-width', 1).attr('stroke', 'rgba(50, 50, 50, 0.2)');

        linkElements = linkEnter.merge(linkElements);

        // nodes
        nodeElements = nodeGroup.selectAll('circle').data(nodes, node => node.id);
        nodeElements.exit().remove();

        const nodeEnter = nodeElements
            .enter()
            .append('circle')
            .attr('r', 25)
            .attr('fill', '#bbdefb')
            .attr('stroke', '#2196f3')
            .attr('stroke-width', 1)
            .call(dragDrop)
            // we link the selectNode method here
            // to update the graph on every click
            .on('click', onNodeClick);

        nodeElements = nodeEnter.merge(nodeElements);

        // texts
        textElements = textGroup.selectAll('text').data(nodes, node => node.id);
        textElements.exit().remove();

        const textEnter = textElements
            .enter()
            .append('text')
            .text(node => node.id)
            .attr('font-size', 8)
            .attr('dx', 0)
            .attr('dy', 2);

        textElements = textEnter.merge(textElements);
    }

    function updateSimulation() {
        updateGraph();

        simulation.nodes(nodes).on('tick', () => {
            nodeElements.attr('cx', node => node.x).attr('cy', node => node.y);
            textElements.attr('x', node => node.x).attr('y', node => node.y);
            linkElements
                .attr('x1', link => link.source.x)
                .attr('y1', link => link.source.y)
                .attr('x2', link => link.target.x)
                .attr('y2', link => link.target.y);
        });

        simulation.force('link').links(links);
        simulation.restart();
    }

    // last but not least, we call updateSimulation
    // to trigger the initial render
    updateSimulation();
}
