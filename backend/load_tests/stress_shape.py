from locust import LoadTestShape


class StepLoadShape(LoadTestShape):
    """Ступенчатая нагрузка: ищем точку деградации.

    Каждая ступень — step_time секунд (разгон + выдержка), пользователи
    растут от шага к шагу. После последней ступени тест завершается.
    """

    step_time = 150  # секунд на ступень
    step_users = [10, 25, 50, 100, 200, 400]
    spawn_rate = 10  # пользователей в секунду

    def tick(self):
        run_time = self.get_run_time()
        step = int(run_time // self.step_time)
        if step >= len(self.step_users):
            return None
        return self.step_users[step], self.spawn_rate
