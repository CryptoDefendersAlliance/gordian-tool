import * as neo4jApi from './neo4jApi';
import * as utils from './utils';

let _graphData = null;

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
        _graphData = neo4jApi.convertTxsToGraphData(txs);
        renderGraph();
    }));
}


function mergeGraphData(newGraphData) {
    utils.mergeLists(_graphData.nodes, newGraphData.nodes, (a, b) => b.id === a.id);
    utils.mergeLists(_graphData.links, newGraphData.links, (a, b) => b.hash === a.hash);
}

function renderGraph() {
    const width = 1200;
    const height = 500;

    let svg = window.d3.select('#neo4j-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom().on('zoom', () => {
            svg.attr('transform', d3.event.transform);
        }))
        .append('g');

    // // link arrow
    // svg
    //     .append('svg:defs')
    //     .append('svg:marker')
    //     .attr('id', 'arrow')
    //     .attr('viewBox', '0 -5 10 10')
    //     .attr('refX', 52)
    //     .attr('refY', -2)
    //     .attr('markerWidth', 6)
    //     .attr('markerHeight', 6)
    //     .attr('orient', 'auto')
    //     .append('path')
    //     .attr('d', 'M0,-5L10,0L0,5')
    //     .style('fill', 'black');


    let linkElements;
    let nodeElements;
    let textElements;

    // we use svg groups to logically group the elements together
    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    const textGroup = svg.append('g').attr('class', 'texts');

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

    function onNodeClick(d) {
        neo4jApi.loadTxsByAddress(d.id).then(txs => {
            const graphData = neo4jApi.convertTxsToGraphData(txs);
            mergeGraphData(graphData);
            updateSimulation();
        });
    }

    function updateGraph() {
        // links
        linkElements = linkGroup.selectAll('path').data(_graphData.links, link => link.hash);
        linkElements.exit().remove();
        const linkEnter = linkElements
            .enter()
            .append('path')
            .attr('stroke-width', d => d.value)
            .attr('stroke', 'rgba(50, 50, 50, 0.2)')
            .attr('fill', 'none');
            // .attr('marker-end', 'url(#arrow)'); // append arraow to the line

        linkElements = linkEnter.merge(linkElements);

        // nodes
        nodeElements = nodeGroup.selectAll('circle').data(_graphData.nodes, node => node.id);
        nodeElements.exit().remove();

        const nodeEnter = nodeElements
            .enter()
            .append('circle')
            .attr('r', 25) // TODO move to param - to sync with arrow
            .attr('fill', '#bbdefb')
            .attr('stroke', '#2196f3')
            .attr('stroke-width', 1)
            .call(dragDrop)
            .on('click', onNodeClick);

        nodeElements = nodeEnter.merge(nodeElements);

        // texts
        textElements = textGroup.selectAll('text').data(_graphData.nodes, node => node.id);
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

    function linkArc(d) {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return 'M' + d.source.x + ',' + d.source.y + 'A' + dr + ',' + dr + ' 0 0,1 ' + d.target.x + ',' + d.target.y;
    }

    function updateSimulation() {
        updateGraph();

        simulation.nodes(_graphData.nodes).on('tick', () => {
            nodeElements.attr('cx', node => node.x).attr('cy', node => node.y);
            textElements.attr('x', node => node.x).attr('y', node => node.y);
            linkElements.attr('d', linkArc);
        });

        simulation.force('link').links(_graphData.links);
        simulation.restart();
    }

    // last but not least, we call updateSimulation
    // to trigger the initial render
    updateSimulation();
}
