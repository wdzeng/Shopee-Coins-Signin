import assert from 'node:assert'

import axios from 'axios'

import { parseCookie } from '@/api/cookie'
import { InvalidCookieError, ShopeeError, UserNotLoggedInError } from '@/api/errors'
import type { CoinsResponse } from '@/api/v1-types/coins'
import type { CheckinResponse } from '@/api/v2-types/checkin'
import type { SettingsResponse } from '@/api/v2-types/settings'

export interface CheckinHistory {
  amounts: [number, number, number, number, number, number, number]
  checkedInToday: boolean
  todayIndex: number
}

export default class ShopeeBot {
  constructor(private readonly cookie: string) {}

  private handleErrorResponse(responseData: object): void {
    if (
      'code' in responseData &&
      typeof responseData.code === 'number' &&
      'msg' in responseData &&
      typeof responseData.msg === 'string'
    ) {
      if (responseData.code === 401) {
        throw new UserNotLoggedInError()
      } else if (responseData.code !== 0) {
        throw new ShopeeError(responseData.code, `Shopee server: ${responseData.msg}`)
      }
    }
  }

  private async getCoinsApiResponseBody(): Promise<CoinsResponse> {
    const url = 'https://shopee.tw/mkt/coins/api/v1/cs/coins'
    const response = await axios<CoinsResponse>(url, {
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-cache',
        'cookie': this.cookie,
        'pragma': 'no-cache',
        'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    })
    this.handleErrorResponse(response.data)
    return response.data
  }

  async checkin(): Promise<number | false> {
    const checkinApiUrl = 'https://shopee.tw/mkt/coins/api/v2/checkin_new'
    const cookieItems = parseCookie(this.cookie)
    if (!cookieItems.shopee_webUnique_ccd) {
      throw new InvalidCookieError('Missing required cookie: shopee_webUnique_ccd')
    }
    const dfp = decodeURIComponent(cookieItems.shopee_webUnique_ccd)
    const requestBody = JSON.stringify({ dfp })
    const response = await axios.post<CheckinResponse>(checkinApiUrl, requestBody, {
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-cache',
        'content-type': 'application/json;charset=UTF-8',
        'cookie': this.cookie,
        'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    })
    this.handleErrorResponse(response.data)
    assert('data' in response.data)
    return response.data.data.success ? response.data.data.increase_coins : false
  }

  async getBalance(): Promise<number> {
    const coinsResponseBody = await this.getCoinsApiResponseBody()
    return coinsResponseBody.coins
  }

  async getCheckinHistory(): Promise<CheckinHistory> {
    const settingsApiUrl = 'https://shopee.tw/mkt/coins/api/v2/settings'
    const response = await axios<SettingsResponse>(settingsApiUrl, {
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-cache',
        'cookie': this.cookie,
        'pragma': 'no-cache',
        'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    })
    this.handleErrorResponse(response.data)
    assert('data' in response.data)

    if (response.data.data.userid === '-1') {
      throw new UserNotLoggedInError()
    }

    if (response.data.data.checkin_list.length < 7) {
      throw new Error('Unexpected checkin history length')
    }

    return {
      // @ts-expect-error: length of `checkin_list` is always 7
      amounts: response.data.data.checkin_list.slice(0, 7),
      checkedInToday: response.data.data.checked_in_today,
      todayIndex: response.data.data.today_index - 1
    }
  }

  async getLoginUser(): Promise<string> {
    const body = await this.getCoinsApiResponseBody()
    if (body.userid === '-1') {
      throw new UserNotLoggedInError()
    }
    return body.username
  }
}
