const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
// const CopyWebpackPlugin = require('copy-webpack-plugin');

const extractPlugin = new ExtractTextPlugin({
    filename: 'static/css/main.css'
});

module.exports = {
    entry: [
        'babel-polyfill',
        './src/js/app.js',
        './src/scss/main.scss'
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'static/js/bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.js?$/,
                exclude: [/node_modules/, /vendors/],
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: ['env', 'stage-0']
                        }
                    }
                ]
            },
            {
                test: /\.scss?$/,
                use: extractPlugin.extract({
                    use: ['css-loader', 'sass-loader']
                })
            },
            {
                test: /\.html$/,
                use: ['html-loader']
            },
            {
                test: /\.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                exclude: [/vendors/, /img/],
                loader: 'file-loader?name=static/fonts/[name].[ext]'
            },
            {
                test: /\.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                exclude: [/node_modules/, /img/],
                loader: 'file-loader?name=static/fonts/roboto/[name].[ext]'
            },
            {
                test: /\.(png|jpg|gif|svg)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'static',
                    useRelativePath: true
                }
            }
        ]
    },
    plugins: [
        extractPlugin,
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.$': 'jquery',
            'window.jQuery': 'jquery'
        }),
        new HtmlWebpackPlugin({
            template: 'index.ejs',
            filename: 'index.ejs'
        }),
        new CleanWebpackPlugin(['dist'])
    ],
    devServer: {
        index: 'index.ejs'
    },
    devtool: 'source-map',
    target: 'web'
};
