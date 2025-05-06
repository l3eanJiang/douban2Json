import axios from "axios";
import { load } from "cheerio";
import { writeFile } from "fs/promises";

const headers = {
    Cookie: '',
};
const userId = "";
const pageSize = 30; // 每页的电影数量
const timeout = 10000; // 设置超时时间为10秒

// 新增请求间隔函数
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 导出豆瓣我看的影视数据 */
async function fetchData() {
    const items = [];
    const userPage = await axios.get(`https://movie.douban.com/people/${userId}/`, { headers });
    const $ = load(userPage.data);
    const text = $(`a[href="/people/${userId}/collect"][target="_self"]`).text();
    const allCount = parseInt(text.match(/\d+/)?.[0] || 0, 10);
    console.log(`Total movies: ${allCount}`);
    const maxIndex = Math.ceil(allCount / pageSize);
    for (let index = 0; index < maxIndex; index++) {
        await new Promise((resolve) => setTimeout(resolve, randomDelay(2000, 6000)));
        const url = `https://movie.douban.com/people/${userId}/collect?start=${
            index * pageSize
        }&sort=time&rating=all&mode=list&type=all&filter=all`;
        const listPage = await axios.get(url, { headers });
        const $ = load(listPage.data);
        const lis = $("ul.list-view")
            .find("li")
            .map((_index, element) => {
                const movieName = $(element).find("a").text().trim().split("/")[0].trim();
                const movieLink = $(element).find("a").attr("href");
                const watchedAt = $(element).find(".date").text().trim();
                const ratingClass = $(element).find(".date").find("span").attr("class");
                const rating = ratingClass ? parseInt(ratingClass.match(/rating(\d)-t/)?.[1]) || 0 : 0;
                const ratedAt = watchedAt;
                const result = {
                    movieName,
                    movieLink,
                    watched_at: watchedAt ? new Date(watchedAt).toISOString() : "",
                };
                if (rating != 0) {
                    result.rating = rating * 2;
                    result.rated_at = ratedAt ? new Date(ratedAt).toISOString() : "";
                }
                return result;
            })
            .get();
        items.push(...lis);
        console.log(`第${index + 1}页: 完成`);
    }
    await writeFile("movies.json", JSON.stringify(items, null, 2));
    return items;
}

/** 转换豆瓣id为IMDb的id */
async function tansData(items) {
    const newItems = [];
    const errorItems = [];
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.imdb_id) {
            newItems.push(item);
            continue;
        }
        await new Promise((resolve) => setTimeout(resolve, randomDelay(1000, 3000)));
        let detailPage;
        try {
            detailPage = await axios.get(item.movieLink, { headers });
        } catch (error) {
            errorItems.push(item);
            console.log(item.movieLink, error);
            continue;
        }
        const $ = load(detailPage.data);
        const imdbSpan = $('span.pl:contains("IMDb:")');
        if (imdbSpan[0]) {
            const imdbID = imdbSpan[0].nextSibling.nodeValue.trim();
            item.imdb_id = imdbID;
            newItems.push(item);
            console.log(`${index + 1}/${items.length}`);
        } else {
            errorItems.push(item);
            console.log(item.movieLink, "没有找到IMDb ID");
        }
    }
    writeFile("movies.json", JSON.stringify(newItems, null, 2));
    writeFile("errorMovies.json", JSON.stringify(errorItems, null, 2));
}

async function run() {
    if (userId == "") {
        console.log("请在index.js中设置userId");
        return;
    }
    if (headers.Cookie == "") {
        console.log("请在index.js中设置headers.Cookie");
        return;
    }
    const items = await fetchData();
    await tansData(items);
}

run();
